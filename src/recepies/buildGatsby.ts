import { Output, all, StackReference } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { env, domain as envDomain, publicDomain, publicTLD, envTLD } from "dcl-ops-lib/domain";
import { getCertificateFor } from "dcl-ops-lib/certificate";
import { makeSecurityGroupAccessibleFromSharedAlb } from "dcl-ops-lib/acceptAlb";
import { makeSecurityGroupAccessibleFromBastion } from "dcl-ops-lib/acceptBastion";
import { acceptDbSecurityGroupId } from "dcl-ops-lib/acceptDb";
import { setRecord } from "dcl-ops-lib/cloudflare";
import { makeSecurityGroupAccessTheInternet } from "dcl-ops-lib/accessTheInternet";
import { getInternalServiceDiscoveryNamespaceId } from "dcl-ops-lib/supra";
import { getAlb } from "dcl-ops-lib/alb";
import { getVpc } from "dcl-ops-lib/vpc";
import { getPrivateSubnetIds } from "dcl-ops-lib/network"

import { variable, currentStackConfigurations } from "../pulumi/env"
import { albOrigin, serverBehavior, bucketOrigin, defaultStaticContentBehavior, immutableContentBehavior, httpOrigin, httpProxyBehavior, BehaviorOptions } from "../aws/cloudfront";
import { addBucketResource, addEmailResource, createUser } from "../aws/iam";
import { createHostForwardListenerRule } from "../aws/alb";
import { getCluster } from "../aws/ecs";
import { getScopedServiceName, getServiceVersion, getStackId, slug } from "../utils";
import { GatsbyOptions } from "./types";
import * as outputs from "../outputs";
import { createRecordForCloudfront, createServicSubdomain } from "../aws/route53";
import { routingRules } from "../aws/s3";
import { createMetricsSecurityGroupId } from "../aws/ec2";
import { createDockerImage } from "../aws/ecr";
import { createSecurityHeadersLambda } from "../aws/lambda";
import { createImmutableCachePageRule } from "../cloudflare/pageRule";

const prometheus = new StackReference(`prometheus-${env}`)

export async function buildGatsby(config: GatsbyOptions) {
  const serviceName = slug(config.name);
  const serviceNameScoped = getScopedServiceName(config.name);
  const serviceVersion = getServiceVersion()
  const decentralandDomain = config.usePublicTLD ? publicDomain : envDomain
  const serviceTLD = config.usePublicTLD ? publicTLD : envTLD
  const serviceDomain = createServicSubdomain(serviceName, decentralandDomain)
  const emailDomains = []
  const domains = [ serviceDomain, ...(config.additionalDomains || []) ]
  const port = config.servicePort || 4000

  // cloudfront mapping
  let serviceImage: null | string | Output<string> = null
  let environment: awsx.ecs.KeyValuePair[] = []
  let serviceOrigins: Output<aws.types.input.cloudfront.DistributionOrigin>[] = []
  let serviceOrderedCacheBehaviors: Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior>[] = []
  let serviceSecurityGroups: Output<string>[] = []
  let serviceLabel: Record<string, string> = {}

  const tags: Record<string, string> = {
    ServiceName: serviceName,
    StackId: getStackId(),
    Team: config.team || 'default'
  }

  const logGroup = new aws.cloudwatch.LogGroup(serviceNameScoped, {
    name: serviceNameScoped,
    retentionInDays: 60,
    tags,
  })

  const staticLambdaOptions: BehaviorOptions = {}

  if (config.useSecurityHeaders) {
    const securityHeaders = createSecurityHeadersLambda(serviceName, { tags, logGroup })
    staticLambdaOptions.lambdaFunctionAssociations = [
      {
        includeBody: false,
        eventType: 'viewer-response',
        lambdaArn: securityHeaders.qualifiedArn
      }
    ]
  }

  if (config.serviceImage && config.serviceSource) {
    throw new Error(`Config configuration: you can use "serviceImage" or "serviceSource" but not both.`)
  }

  if (config.serviceImage || config.serviceSource) {
    if (config.serviceImage) {
      serviceImage = config.serviceImage as string
    } else {
      serviceImage = createDockerImage(serviceName, config.serviceSource as string)
    }

    const portMappings: awsx.ecs.ContainerPortMappingProvider[] = []
    environment = [
      ...environment,
      variable('ENVIRONMENT', process.env.ENVIRONMENT),
      variable('COMMIT_SHA', process.env.CI_COMMIT_SHA),
      variable('COMMIT_SHORT_SHA', process.env.CI_COMMIT_SHORT_SHA),
      variable('COMMIT_REF_NAME', process.env.CI_COMMIT_REF_NAME),
      variable('COMMIT_BRANCH', process.env.CI_COMMIT_BRANCH),
      variable('COMMIT_TAG', process.env.CI_COMMIT_TAG),
      variable('IMAGE', serviceImage),
      variable('STACK_ID', getStackId()),
      variable('SERVICE_NAME', serviceName),
      variable('SERVICE_VERSION', serviceVersion),
      variable('PROMETHEUS_BEARER_TOKEN', prometheus.getOutput('serviceMetricsBearerToken') ),
      ...currentStackConfigurations(),
      ...(config.serviceEnvironment || []),
    ]
    const vpc = await getVpc()
    const taskSecurityGroup = new awsx.ec2.SecurityGroup(`tsg-${serviceName}`, {
      vpc
    })

    await makeSecurityGroupAccessTheInternet(taskSecurityGroup)
    await makeSecurityGroupAccessibleFromBastion(taskSecurityGroup)

    serviceSecurityGroups = [
      ...serviceSecurityGroups,
      await acceptDbSecurityGroupId(),
    ]

    // if config.servicePaths !== false service will ve public
    if (config.servicePaths !== false) {
      makeSecurityGroupAccessibleFromSharedAlb(taskSecurityGroup)

      // iniject public service environment
      environment = [
        ...environment,
        variable('SERVICE_TLD', serviceTLD), // .org
        variable('SERVICE_ORG_DOMAIN', decentralandDomain), // decentraland.org
        variable('SERVICE_DOMAIN', serviceDomain), // app.decentraland.org
        variable('SERVICE_URL', `https://${serviceDomain}`), // https://app.decentraland.org
        variable('PORT', `${port}`)
      ]

      // grant access to load banlancer
      serviceSecurityGroups = [
        ...serviceSecurityGroups,
        await createMetricsSecurityGroupId(serviceName, port)
      ]

      // create target group
      const { alb, listener } = await getAlb();
      const targetGroup = alb.createTargetGroup(("tg-" + serviceName).slice(-32), {
        vpc,
        port,
        protocol: "HTTP",
        healthCheck: {
          path: config.serviceHealthCheckPath || "/api/status",
          matcher: "200",
          interval: 10,
          unhealthyThreshold: 5,
          healthyThreshold: 5,
        },
      });

      // attach target group to service
      portMappings.push(targetGroup)

      // attach target group to load balancer
      createHostForwardListenerRule(`${env}-ls-${serviceName}`, listener, {
        hosts: domains,
        targetGroup: targetGroup.targetGroup,
      })

      // add load balancer to origin list
      serviceOrigins = [
        ...serviceOrigins,
        albOrigin(alb)
      ]

      // map paths to load balancer
      const servicePaths = config.servicePaths || [ '/api/*' ]
      serviceOrderedCacheBehaviors = [
        ...serviceOrderedCacheBehaviors,
        ...servicePaths.map(servicePath => serverBehavior(servicePath, alb))
      ]

      serviceLabel.ECS_PROMETHEUS_JOB_NAME = serviceName
      serviceLabel.ECS_PROMETHEUS_EXPORTER_PORT = String(port)
      serviceLabel.ECS_PROMETHEUS_METRICS_PATH = config.serviceMetricsPath || '/metrics'
    }

    serviceSecurityGroups = [
      ...serviceSecurityGroups,
      taskSecurityGroup.id,
    ]

    // attach AWS resources
    if (config.useBucket || config.useEmail) {
      const access = createUser(serviceName)

      if (config.useBucket) {
        // create bucket and grant acccess
        const useBucket = config.useBucket === true ? [] : config.useBucket
        const bucket = addBucketResource(serviceName, access.user, useBucket)
        environment = [ ...environment, variable('AWS_BUCKET_NAME', bucket.bucket) ]

        // attach paths to cloudfront
        if (useBucket.length > 0) {
          serviceOrigins = [
            ...serviceOrigins,
            bucketOrigin(bucket)
          ]

          serviceOrderedCacheBehaviors = [
            ...serviceOrderedCacheBehaviors,
            ...useBucket.map(path => immutableContentBehavior(path, bucket, staticLambdaOptions))
          ]
        }
      }

      if (config.useEmail) {
        // grant access to email service
        const useEmail = config.useEmail === true ? [ decentralandDomain ] : config.useEmail

        if (useEmail[0]) {
          addEmailResource(serviceName, access.user, useEmail)
          environment = [ ...environment, variable('AWS_EMAIL_DOMAIN', useEmail[0]) ]

          for (const email of useEmail) {
            emailDomains.push(email)
          }
        }
      }

      environment = [
        ...environment,
        variable('AWS_ACCESS_KEY', access.creds.id),
        variable('AWS_ACCESS_SECRET', access.creds.secret),
      ]
    }

    // create service discovery
    const serviceDiscovery = new aws.servicediscovery.Service(serviceName, {
      name: serviceName,
      description: "service discovery for " + serviceName,
      dnsConfig: {
        dnsRecords: [
          { type: "A", ttl: 10 },
          { type: "SRV", ttl: 10 },
        ],
        namespaceId: getInternalServiceDiscoveryNamespaceId(),
      },
    })

    // create Fargate service
    const cluster = await getCluster()
    new awsx.ecs.FargateService(
      serviceNameScoped,
      {
        cluster,
        subnets: await getPrivateSubnetIds(),
        securityGroups: serviceSecurityGroups,
        desiredCount: config.serviceDesiredCount || 1,
        enableEcsManagedTags: true,
        tags,
        serviceRegistries: {
          port,
          registryArn: serviceDiscovery.arn
        },
        taskDefinitionArgs: {
          tags,
          logGroup,
          containers: {
            [serviceName]: {
              image: serviceImage,
              cpu: config.serviceCPUs,
              memoryReservation: config.serviceMemory || 256,
              essential: true,
              environment,
              // TODO: secrets
              portMappings,
              dockerLabels: serviceLabel,
              logConfiguration: {
                logDriver: "awslogs",
                options: {
                  "awslogs-group": serviceName,
                  "awslogs-region": "us-east-1",
                  "awslogs-stream-prefix": serviceName,
                },
              },
            },
          },
        },
      },
      {
        customTimeouts: {
          create: "5m",
          update: "5m",
          delete: "5m",
        },
      }
    );
  }

  const proxyOrigins = new Set<string>()
  const contentProxy = config.contentProxy || {}
  for (const pathPattern of Object.keys(contentProxy)) {
    const originConfiguration = contentProxy[pathPattern]
    const origin = typeof originConfiguration === 'string' ? originConfiguration : originConfiguration.origin
    if (!proxyOrigins.has(origin)) {
      proxyOrigins.add(origin)
      serviceOrigins = [
        ...serviceOrigins,
        httpOrigin(originConfiguration)
      ]
    }

    serviceOrderedCacheBehaviors = [
      ...serviceOrderedCacheBehaviors,
      httpProxyBehavior(pathPattern, originConfiguration, staticLambdaOptions)
    ]
  }

  const contentRoutingRules = routingRules(config.contentRoutingRules, { hostname: serviceDomain, protocol: 'https' })
  // contentBucket is the S3 bucket that the website's contents will be stored in.
  const contentBucket = new aws.s3.Bucket(`${serviceName}-website`, {
    acl: "private",

    tags: {
      Name: serviceDomain
    },

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
      indexDocument: "index.html",
      errorDocument: "404.html",
      ...(contentRoutingRules.length > 0 && { routingRules: contentRoutingRules })
    },

    corsRules: [
      {
        allowedMethods: ["GET", "HEAD"],
        exposeHeaders: ["ETag"],
        allowedOrigins: ["*"],
        maxAgeSeconds: 3600
      }
    ]
  });

  new aws.s3.BucketPolicy(`${serviceName}-website-bucket-policy`, {
    bucket: contentBucket.bucket,
    policy: contentBucket.bucket.apply((bucket): aws.iam.PolicyDocument => ({
      "Version": "2012-10-17",
      "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                `arn:aws:s3:::${bucket}/*`
            ]
        }
      ]
    }))
  })

  // add bucket to the origin list
  serviceOrigins = [
    ...serviceOrigins,
    bucketOrigin(contentBucket)
  ]

  // logsBucket is an S3 bucket that will contain the CDN's request logs.
  const logs = new aws.s3.Bucket(serviceName + "-logs", { acl: "log-delivery-write" });
  const cdn = all([
    defaultStaticContentBehavior(contentBucket, staticLambdaOptions),
    all(serviceOrigins),
    all(serviceOrderedCacheBehaviors),
    logs.bucketDomainName
  ])
  .apply(([
    defaultContentBehavior,
    serviceOrigins,
    serviceOrderedCacheBehaviors,
    logsBucketDomainName
  ]) => new aws.cloudfront.Distribution(serviceName + "-cdn", {
    // From this field, you can enable or disable the selected distribution.
    enabled: true,

    // (Optional) Specify the maximum HTTP version that you want viewers to use to communicate with CloudFront.
    // The default value for new web distributions is http1.1. For viewers and CloudFront to use HTTP/2,
    // viewers must support TLS 1.2 or later, and must support server name identification (SNI).
    // In general, configuring CloudFront to communicate with viewers using HTTP/2 reduces latency.
    // You can improve performance by optimizing for HTTP/2. (values: http1.1 | http2)
    httpVersion: 'http2',

    // Alternate aliases the CloudFront distribution can be reached at, in addition to https://xxxx.cloudfront.net.
    // Required if you want to access the distribution via config.targetDomain as well.
    aliases: domains,

    // We only specify one origin for this distribution, the S3 content bucket.
    defaultRootObject: "index.html",
    origins: [ ...serviceOrigins ],

    // A CloudFront distribution can configure different cache behaviors based on the request path.
    // Here we just specify a single, default cache behavior which is just read-only requests to S3.
    defaultCacheBehavior: defaultContentBehavior,
    orderedCacheBehaviors: [ ...serviceOrderedCacheBehaviors ],

    // "All" is the most broad distribution, and also the most expensive.
    // "100" is the least broad, and also the least expensive.
    // (values: PriceClass_100 | PriceClass_200 | PriceClass_All)
    priceClass: "PriceClass_100",

    // You can customize error responses. When CloudFront recieves an error from the origin (e.g. S3 or some other
    // web service) it can return a different error code, and return the response for a different resource.
    customErrorResponses: [],

    // A complex type that identifies ways in which you want to restrict distribution of your content.
    restrictions: {
      geoRestriction: {
        restrictionType: "none",
      },
    },

    // A complex type that determines the distribution’s SSL/TLS configuration for communicating with viewers.
    viewerCertificate: {
      acmCertificateArn: getCertificateFor(serviceDomain),
      sslSupportMethod: "sni-only",
    },

    // A complex type that controls whether access logs are written for the distribution.
    loggingConfig: {
      bucket: logsBucketDomainName,
      includeCookies: false,
      prefix: `${serviceDomain}/`,
    },
  }));

  const records = domains.map(domain => createRecordForCloudfront(domain, cdn))
  if (config.usePublicTLD) {
    await setRecord({
      proxied: true,
      type: 'CNAME',
      recordName: serviceName,
      value: cdn.domainName
    })

    if (config.contentImmutableCache && config.contentImmutableCache.length > 0) {
      for (const path of config.contentImmutableCache) {
        const target = serviceDomain + path
        createImmutableCachePageRule(serviceName, target)
      }
    }
  }

  // Export properties from this stack. This prints them at the end of `pulumi up` and
  // makes them easier to access from the pulumi.com.
  const output: Record<string, any> = {
    bucketName: contentBucket.bucket,
    logsBucket: logs.bucket,
    cloudfrontDistribution: cdn.id,

    // debbuggin information
    ...outputs.cloudfrontDistributionBehaviors(cdn),
    ...outputs.securityGroups(serviceSecurityGroups),
    ...outputs.serviceImage(serviceImage),
    ...outputs.environmentVariables(environment),
    ...outputs.emailDomains(emailDomains),
    ...outputs.domainRecord(records[0]),
  }

  return output
}
