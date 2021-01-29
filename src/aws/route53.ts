import * as aws from '@pulumi/aws'
import { all, Output } from '@pulumi/pulumi'

export function createServicSubdomain(serviceName: string, tldDomain: string) {
  return `${serviceName}.${tldDomain}`
}

/**
 *
 * @param serviceName
 * @param tldDomain
 * @param cdn
 */
export function createRecordForCloudfront(serviceName: string, tldDomain: string, cdn: aws.cloudfront.Distribution | Output<aws.cloudfront.Distribution>) {
  const serviceDomain = createServicSubdomain(serviceName, tldDomain)

  const hostedZoneId = aws.route53
    .getZone({ name: tldDomain }, { async: true })
    .then((zone: { zoneId: string }) => zone.zoneId)

  return all([ cdn ]).apply(([cdn]) => new aws.route53.Record(serviceDomain, {
    name: serviceName,
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