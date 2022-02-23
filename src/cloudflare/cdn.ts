import * as aws from '@pulumi/aws'
import * as cloudflare from '@pulumi/cloudflare'
import { getZoneId } from 'dcl-ops-lib/cloudflare'
import { getServiceNameAndTLD } from '../utils'

export function isCloudflareDomain(domain: string) {
  return domain.endsWith('.org') ||
    domain.endsWith('.today') ||
    domain.endsWith('.zone') ||
    domain.endsWith('.systems') ||
    domain.endsWith('.services')
}

/**
 * Create a CNAME record on Cloudflare pointing to a `aws.cloudfront.Distribution`
 */
export function createRecordForCloudfrontDistribution(domain: string, distribution: Pick<aws.cloudfront.Distribution, "domainName">) {
  const [ serviceSubdomain, serviceTLD ] = getServiceNameAndTLD(domain)
  const tld = serviceTLD.split('.').slice(-1).join('')

  return new cloudflare.Record(
    `${serviceSubdomain || serviceTLD}-cname-${tld}`,
    {
      type: 'CNAME',
      name: serviceSubdomain || serviceTLD,
      value: distribution.domainName,
      zoneId: getZoneId(),
      proxied: true,
      ttl: 1,
    }
  )
}

/**
 * Create a CNAME record on Cloudflare pointing to a `aws.lb.LoadBalancer`
 */
export function createRecordForLoadBalancer(domain: string, loadBalancer: Pick<aws.lb.LoadBalancer, "dnsName">) {
  const [ serviceSubdomain, serviceTLD ] = getServiceNameAndTLD(domain)
  const tld = serviceTLD.split('.').slice(-1).join('')

  return new cloudflare.Record(
    `${serviceSubdomain || serviceTLD}-cname-${tld}`,
    {
      type: 'CNAME',
      name: serviceSubdomain || serviceTLD,
      value: loadBalancer.dnsName,
      zoneId: getZoneId(),
      proxied: true,
      ttl: 1,
    }
  )
}