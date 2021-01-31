import { Output, all } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { env, domain as envDomain, publicDomain, publicTLD, envTLD } from "dcl-ops-lib/domain";
import { getCertificateFor } from "dcl-ops-lib/certificate";
import { acceptAlbSecurityGroupId } from "dcl-ops-lib/acceptAlb";
import { acceptBastionSecurityGroupId } from "dcl-ops-lib/acceptBastion";
import { acceptDbSecurityGroupId } from "dcl-ops-lib/acceptDb";
import { accessTheInternetSecurityGroupId } from "dcl-ops-lib/accessTheInternet";
import { getAlb } from "dcl-ops-lib/alb";
import { getPrivateSubnetIds } from "dcl-ops-lib/network"

import { variable, currentStackConfigurations } from "../pulumi/env"
import { albOrigin, serverBehavior, bucketOrigin, defaultStaticContentBehavior, immutableContentBehavior } from "../aws/cloudfront";
import { addBucketResource, addEmailResource, createUser } from "../aws/iam";
import { createHostForwardListenerRule } from "../aws/alb";
import { getCluster } from "../aws/ecs";
import { getServiceVersion, slug } from "../utils";
import { GatsbyOptions } from "./types";
import * as outputs from "../outputs";
import { createRecordForCloudfront, createServicSubdomain } from "../aws/route53";

export async function buildGatsby(config: GatsbyOptions) {
  const serviceName = slug(config.name);
  const serviceVersion = getServiceVersion()
  const decentralandDomain = config.usePublicTLD ? publicDomain : envDomain
  const serviceTLD = config.usePublicTLD ? publicTLD : envTLD
  const serviceDomain = createServicSubdomain(serviceName, decentralandDomain)
  const emailDomains = []
  const domains = [ serviceDomain, ...(config.additionalDomains || []) ]
  const port = config.servicePort || 4000

  // cloudfront mapping
  let environment: awsx.ecs.KeyValuePair[] = []
  let serviceOrigins: Output<aws.types.input.cloudfront.DistributionOrigin>[] = []
  let serviceOrderedCacheBehaviors: Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior>[] = []
  let serviceSecurityGroups: Output<string>[] = []

  if (config.serviceImage) {
    const portMappings: awsx.ecs.ContainerPortMappingProvider[] = []
    environment = [
      ...environment,
      variable('IMAGE', config.serviceImage),
      variable('SERVICE_NAME', serviceName),
      variable('SERVICE_VERSION', serviceVersion),
      ...currentStackConfigurations(),
      ...(config.serviceEnvironment || []),
    ]

    const cluster = await getCluster()
    serviceSecurityGroups = [
      ...serviceSecurityGroups,
      await acceptBastionSecurityGroupId(),
      await acceptDbSecurityGroupId(),
      await accessTheInternetSecurityGroupId(),
    ]

    // if config.servicePaths !== false service will ve public
    if (config.servicePaths !== false) {
      // iniject public service environment
      environment = [
        ...environment,
        variable('SERVICE_TLD', serviceTLD),
        variable('SERVICE_DOMAIN', serviceDomain),
        variable('SERVICE_URL', `https://${serviceDomain}`),
        variable('PORT', `${port}`)
      ]

      // grant access to load banlancer
      serviceSecurityGroups = [
        ...serviceSecurityGroups,
        await acceptAlbSecurityGroupId()
      ]

      // create target group
      const { alb, listener } = await getAlb();
      const targetGroup = alb.createTargetGroup(("tg-" + serviceName).slice(-32), {
        port,
        protocol: "HTTP",
        vpc: awsx.ec2.Vpc.getDefault(),
        healthCheck: {
          path: config.serviceHealthCheck || "/api/status",
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
        ...servicePaths.map(servicePath => serverBehavior(alb, servicePath))
      ]
    }

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
            ...useBucket.map(path => immutableContentBehavior(bucket, path))
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

    // create Fargate service
    new awsx.ecs.FargateService(
      `${serviceName}-${serviceVersion}`,
      {
        cluster,
        subnets: await getPrivateSubnetIds(),
        securityGroups: serviceSecurityGroups,
        desiredCount: config.serviceDesiredCount || 1,
        taskDefinitionArgs: {
          containers: {
            service: {
              image: config.serviceImage,
              memoryReservation: config.serviceMemory || 256,
              essential: true,
              environment,
              portMappings,
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

  // const userAndBucket = createBucketWithUser(`builder-assetpacks-${env}`)
  // contentBucket is the S3 bucket that the website's contents will be stored in.
  const contentBucket = new aws.s3.Bucket(`${serviceName}-website`, {
    acl: "public-read",

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
      indexDocument: "index.html",
      errorDocument: "404.html",
      // routingRules: []
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
    defaultStaticContentBehavior(contentBucket),
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
    // loggingConfig: {
    //   bucket: logsBucketDomainName,
    //   includeCookies: false,
    //   prefix: `${serviceDomain}/`,
    // },
  }));

  const record = createRecordForCloudfront(serviceName, decentralandDomain, cdn)

  // Export properties from this stack. This prints them at the end of `pulumi up` and
  // makes them easier to access from the pulumi.com.
  const output: Record<string, any> = {
    bucketName: contentBucket.bucket,
    logsBucket: logs.bucket,
    cloudfrontDistribution: cdn.id,

    // debbuggin information
    ...outputs.cloudfrontDistributionBehaviors(cdn),
    ...outputs.securityGroups(serviceSecurityGroups),
    ...outputs.environmentVariables(environment),
    ...outputs.emailDomains(emailDomains),
    ...outputs.domainRecords(record)
  }

  return output
}
