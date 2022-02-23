import * as aws from '@pulumi/aws'
import { getServiceNameAndTLD } from '../utils'

export function createServicSubdomain(serviceName: string, tldDomain: string) {
  return `${serviceName}.${tldDomain}`
}

/**
 * Create an A record on AWS Route53 pointing to a `aws.cloudfront.Distribution`
 */
export function createRecordForCloudfrontDistribution(domain: string, distribution: Pick<aws.cloudfront.Distribution, "domainName" | "hostedZoneId">) {
  const [serviceSubdomain, serviceTLD] = getServiceNameAndTLD(domain)

  const hostedZoneId = aws.route53
    .getZone({ name: serviceTLD }, { async: true })
    .then((zone: { zoneId: string }) => zone.zoneId)

  return new aws.route53.Record(
    `${domain}-a`,
    {
      name: serviceSubdomain || '',
      zoneId: hostedZoneId,
      type: "A",
      aliases: [
        {
          name: distribution.domainName,
          zoneId: distribution.hostedZoneId,
          evaluateTargetHealth: false,
        },
      ],
    })
}

/**
 * Create an A record on AWS Route53 pointing to a `aws.lb.LoadBalancer`
 */
export function createRecordForLoadBalancer(domain: string, loadBalancer: Pick<aws.lb.LoadBalancer, "dnsName" | "zoneId">) {
  const [serviceSubdomain, serviceTLD] = getServiceNameAndTLD(domain)

  const hostedZoneId = aws.route53
    .getZone({ name: serviceTLD }, { async: true })
    .then((zone: { zoneId: string }) => zone.zoneId)

  return new aws.route53.Record(
    `${domain}-a`,
    {
      name: serviceSubdomain || '',
      zoneId: hostedZoneId,
      type: "A",
      aliases: [
        {
          name: loadBalancer.dnsName,
          zoneId: loadBalancer.zoneId,
          evaluateTargetHealth: false,
        },
      ],
    })
}
