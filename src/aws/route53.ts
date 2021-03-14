import * as aws from '@pulumi/aws'
import { all, Output } from '@pulumi/pulumi'

export function createServicSubdomain(serviceName: string, tldDomain: string) {
  return `${serviceName}.${tldDomain}`
}

export function recovereServiceSubsomain(domain: string) {
  const parts = domain.split('.')
  if (parts.length >= 3) {
    return [
      parts.slice(0, -2).join('.'),
      parts.slice(-2).join('.'),
    ] as const
  } else if (parts.length === 2) {
    return [ null, parts.join('.') ] as const
  } else {
    throw new Error(`Invalid domain: "${domain}"`)
  }
}

/**
 *
 * @param serviceName
 * @param tldDomain
 * @param cdn
 */
export function createRecordForCloudfront(serviceDomain: string, cdn: aws.cloudfront.Distribution | Output<aws.cloudfront.Distribution>) {
  const [ serviceName, tld ] = recovereServiceSubsomain(serviceDomain)

  const hostedZoneId = aws.route53
    .getZone({ name: tld }, { async: true })
    .then((zone: { zoneId: string }) => zone.zoneId)

  return all([ cdn ]).apply(([cdn]) => new aws.route53.Record(serviceDomain, {
    name: serviceName || '',
    zoneId: hostedZoneId,
    type: "A",
    aliases: [
      {
        name: cdn.domainName,
        zoneId: cdn.hostedZoneId,
        evaluateTargetHealth: false,
      },
    ],
  }))
}