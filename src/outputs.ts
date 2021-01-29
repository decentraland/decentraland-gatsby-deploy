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
  if (!environment || environment.length === 0) {
    return {}
  }

  const environmentVariables = all(environment).apply(values => {
    return values.reduce(
      (result, env) => {
        if (env) {
          result[env.name] = env.value
        }

        return result
      },
      {} as Record<string, string>
    )
  })

  return { environmentVariables }
}

export function domainRecords(r: Output<aws.route53.Record> | null | undefined) {
  if (!r) {
    return {}
  }

  const domainRecords = r.apply(record => {
    return all([
      record.type,
      record.aliases,
    ]).apply(([type, alias]) => {
      if (!alias) {
        return []
      }

      const maxLen = Math.max(...alias.map(a => a.name.length))
      return alias.map(a => {
        return `${(a.name + ' '.repeat(maxLen)).slice(0, maxLen)} ${type} ${a.zoneId}`
      })
    })
  })

  return { domainRecords }
}