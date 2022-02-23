import { all, Output } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as cloudflare from "@pulumi/cloudflare";

export function cloudfrontDistributionBehaviors(distribution: aws.cloudfront.Distribution) {
  return {
    distribution: all([distribution.defaultCacheBehavior, distribution.orderedCacheBehaviors])
      .apply(([defaultCacheBehavior, orderedCacheBehaviors]) => ({
          id: distribution.id,
          domainName: distribution.domainName,
          hostedZoneId: distribution.hostedZoneId,
          cacheBehavior: [
            ...(orderedCacheBehaviors || []).map(behavior => `${behavior.pathPattern} => ${behavior.targetOriginId}`),
            `* => ${defaultCacheBehavior.targetOriginId}`
          ]
      }))
  }
}

export function securityGroups(sg: Output<string>[] | string[] | null | undefined) {
  if (!sg || sg.length === 0) {
    return {}
  }

  return { securityGroups: all(sg) }
}

export function emailDomains(domains: Output<string>[] | string[] | null | undefined) {
  if (!domains || domains.length === 0) {
    return {}
  }

  return { emailDomains: all(domains) }
}

export function environmentVariables(environment: (awsx.ecs.KeyValuePair | null | undefined)[] | null | undefined) {
  if (!environment) {
    return {}
  }

  environment = environment.filter(Boolean)
  if (environment.length === 0) {
    return {}
  }

  const environmentVariables = environment
    .map(env => all([env!.name, env!.value])
      .apply(([name, value]) => `${name}=${value}`)
    )

  return { environmentVariables }
}

export function serviceImage(serviceImage: null | string | Output<string>) {
  if (!serviceImage) {
    return {}
  }

  return { serviceImage }
}

function route53Record(record: aws.route53.Record | cloudflare.Record) {
  return all([
    record.name,
    record.type,
    (record as cloudflare.Record).hostname,
    (record as aws.route53.Record).aliases,
  ]).apply(([name, type, hostname, aliases]) => {
    if (hostname) {
      return `${name} ${type} ${hostname}`
    }

    if (aliases && aliases.length > 0) {
      return aliases.map(alias => `${name} ${type} ${alias.name}`).join('\n')
    }

    return null
  })
}

export function domainRecord(record: aws.route53.Record | cloudflare.Record | null | undefined) {
  if (!record) {
    return {}
  }

  const domainRecords = route53Record(record)

  if (!domainRecords) {
    return {}
  }

  return { domainRecords }
}

export function domainRecords(records: (aws.route53.Record | cloudflare.Record)[]) {
  return {
    domainRecords: all(records.map(route53Record))
  }
}
