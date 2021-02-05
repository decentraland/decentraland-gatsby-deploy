import { all, Output } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

export function cloudfrontDistributionBehaviors(cdn: Output<aws.cloudfront.Distribution>) {
  return { cloudfrontDistributionBehaviors: cdn
    .apply(cdn => all([ cdn.defaultCacheBehavior, cdn.orderedCacheBehaviors])
    .apply(([ defaultCacheBehavior, orderedCacheBehaviors ]) => {
      const behaviors: Record<string, string> = {
        '*': defaultCacheBehavior.targetOriginId
      }

      if (orderedCacheBehaviors) {
        for (const behavior of orderedCacheBehaviors) {
          behaviors[behavior.pathPattern] = behavior.targetOriginId
        }
      }

      return behaviors
    })
  )}
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

export function domainRecords(record: Output<aws.route53.Record> | null | undefined) {
  if (!record) {
    return {}
  }

  const domainRecords = record.apply(record => {
    return all([
      record.name,
      record.type,
      record.aliases,
    ]).apply(([name, type, aliases]) => {
      if (!aliases || aliases.length === 0) {
        return null
      }

      const alias = aliases[0]
      return `${name} ${type} ${alias.name}`
    })
  })

  if (!domainRecords) {
    return {}
  }

  return { domainRecords }
}