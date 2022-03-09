import { Output, all, StackReference } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import { env, domain as envDomain, publicDomain, publicTLD, envTLD } from "dcl-ops-lib/domain";
import { makeSecurityGroupAccessibleFromSharedAlb } from "dcl-ops-lib/acceptAlb";
import { makeSecurityGroupAccessibleFromBastion } from "dcl-ops-lib/acceptBastion";
import { acceptDbSecurityGroupId } from "dcl-ops-lib/acceptDb";
import { makeSecurityGroupAccessTheInternet } from "dcl-ops-lib/accessTheInternet";
import { getInternalServiceDiscoveryNamespaceId } from "dcl-ops-lib/supra";
import { getAlb } from "dcl-ops-lib/alb";
import { getVpc } from "dcl-ops-lib/vpc";
import { getPrivateSubnetIds } from "dcl-ops-lib/network"

import { variable, currentStackConfigurations } from "../pulumi/env"
import { albOrigin, serverBehavior, bucketOrigin, defaultStaticContentBehavior, immutableContentBehavior, httpOrigin, httpProxyBehavior, BehaviorOptions, uniqueOrigins, staticSecurityHeadersPolicy } from "../aws/cloudfront";
import { addBucketResource, addEmailResource, createUser } from "../aws/iam";
import { createHostForwardListenerRule } from "../aws/alb";
import { getCluster } from "../aws/ecs";
import { getScopedServiceName, getServiceName, getServiceVersion, getServiceSubdomain, getStackId, getServiceDomains } from "../utils";
import { GatsbyOptions } from "./types";
import { createMetricsSecurityGroupId } from "../aws/ec2";
import { createDockerImage } from "../aws/ecr";
import { buildContentBucket } from "./buildContentBucket";
import { buildCloudfrontDistribution } from "./buildCloudfrontDistribution";
import { routeToCloudfrontDistribution } from "./routeDomains";
import { createRoutingRules } from "../aws/s3";

const prometheus = new StackReference(`prometheus-${env}`)

export async function buildGatsby(config: GatsbyOptions) {
  console.log(`runngin gatsby recipe: `, JSON.stringify(config, null, 2))
  const serviceName = getServiceName(config);
  const serviceNameScoped = getScopedServiceName(config);
  const serviceVersion = getServiceVersion()
  const decentralandDomain = config.usePublicTLD ? publicDomain : envDomain
  const serviceTLD = config.usePublicTLD ? publicTLD : envTLD
  const serviceDomain = getServiceSubdomain(config)
  const domains = getServiceDomains(config)
  const port = config.servicePort || 4000
  const emailDomains = []

  // cloudfront mapping
  let serviceImage: null | string | Output<string> = null
  let environment: awsx.ecs.KeyValuePair[] = []
  let serviceOrigins: Output<aws.types.input.cloudfront.DistributionOrigin>[] = []
  let serviceOrderedCacheBehaviors: Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior>[] = []
  let serviceSecurityGroups: Output<string>[] = []
  let serviceLabel: Record<string, string> = {}
  let serviceDiscovery: null | aws.servicediscovery.Service = null
  let serviceTargetGroup: null | awsx.elasticloadbalancingv2.ApplicationTargetGroup = null
  let cluster: null | awsx.ecs.Cluster = null
  let fargate: null | awsx.ecs.FargateService = null

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


  const staticLambdaOptions: BehaviorOptions = {
    responseHeadersPolicyId: staticSecurityHeadersPolicy(serviceName).id
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
      serviceTargetGroup = alb.createTargetGroup(("tg-" + serviceName).slice(-32), {
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
      portMappings.push(serviceTargetGroup)

      // attach target group to load balancer
      createHostForwardListenerRule(`${env}-ls-${serviceName}`, listener, {
        hosts: domains,
        targetGroup: serviceTargetGroup.targetGroup,
      })

      // add load balancer to origin list
      serviceOrigins = [
        ...serviceOrigins,
        albOrigin(alb.loadBalancer)
      ]

      // map paths to load balancer
      const servicePaths = config.servicePaths || [ '/api/*' ]
      serviceOrderedCacheBehaviors = [
        ...serviceOrderedCacheBehaviors,
        ...servicePaths.map(servicePath => serverBehavior(servicePath, alb.loadBalancer))
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
    serviceDiscovery = new aws.servicediscovery.Service(serviceName, {
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
    cluster = await getCluster()
    fargate = new awsx.ecs.FargateService(
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

  const contentProxy = config.contentProxy || {}
  serviceOrigins = [
    ...serviceOrigins,
    ...Object.keys(contentProxy)
      .map(pathPattern => httpOrigin(contentProxy[pathPattern]))
  ]

  serviceOrderedCacheBehaviors = [
    ...serviceOrderedCacheBehaviors,
    ...Object.keys(contentProxy)
      .map(pathPattern => httpProxyBehavior(pathPattern, contentProxy[pathPattern], staticLambdaOptions)),
  ]

  const bucket = buildContentBucket({
    name: config.name,
    routingRules: createRoutingRules(
      config.contentRoutingRules,
      { hostname: serviceDomain }
    )
  })

  // add bucket to the origin list
  serviceOrigins = [
    ...serviceOrigins,
    bucketOrigin(bucket.contentBucket)
  ]

  // logsBucket is an S3 bucket that will contain the CDN's request logs.
  const cdn = buildCloudfrontDistribution({
    ...config,
    origins: all(serviceOrigins).apply(uniqueOrigins),
    defaultCacheBehavior: defaultStaticContentBehavior(bucket.contentBucket, staticLambdaOptions),
    orderedCacheBehaviors: all(serviceOrderedCacheBehaviors)
  });

  /**
   * Create DNS records
   */
  const records = routeToCloudfrontDistribution(domains, cdn.distribution)

  // Export properties from this stack. This prints them at the end of `pulumi up` and
  // makes them easier to access from the pulumi.com.
  return {
    ...bucket,
    ...cdn,
    records,
    cluster,
    fargate,
    serviceImage,
    serviceDiscovery,
    serviceTargetGroup,
    serviceLabel,
    tags,
    environment,
  }
}
