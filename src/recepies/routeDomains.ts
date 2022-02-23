import * as aws from "@pulumi/aws";
import * as cloudflare from "@pulumi/cloudflare";
import {
  createRecordForCloudfrontDistribution as createAwsRecordForCloudfrontDistribution,
  createRecordForLoadBalancer as createAwsRecordForLoadBalancer,
} from "../aws/route53";
import {
  createRecordForCloudfrontDistribution as createCloudflareRecordForCloudfrontDistribution,
  createRecordForLoadBalancer as createCloudflareRecordForLoadBalancer
} from "../cloudflare/cdn";
import { isCloudflareDomain } from "../cloudflare/cdn";

/**
 * Create Route53 and Cloudflare record to expose services
 */
export function routeToCloudfronDistribution(domains: string[], distribution: Pick<aws.cloudfront.Distribution, "domainName" | "hostedZoneId">) {
  const records: (aws.route53.Record | cloudflare.Record)[] = []

  for (const domain of domains) {
    records.push(createAwsRecordForCloudfrontDistribution(domain, distribution))
    if (isCloudflareDomain(domain)) {
      records.push(createCloudflareRecordForCloudfrontDistribution(domain, distribution))
    }
  }

  return records
}

export function routeToLoadBalancer(domains: string[], loadBalancer: Pick<aws.lb.LoadBalancer, "dnsName" | "zoneId">) {
  const records: (aws.route53.Record | cloudflare.Record)[] = []

  for (const domain of domains) {
    records.push(createAwsRecordForLoadBalancer(domain, loadBalancer))
    if (isCloudflareDomain(domain)) {
      records.push(createCloudflareRecordForLoadBalancer(domain, loadBalancer))
    }
  }

  return records

}