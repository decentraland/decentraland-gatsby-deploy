import * as aws from "@pulumi/aws";
import { getCertificateFor } from "dcl-ops-lib/certificate";
import { getServiceDomains, getServiceName, getServiceSubdomain } from "../utils";
import { GatsbyOptions } from "./types";

export type CloudfrontDistributionOptions =
  Pick<GatsbyOptions, "name" | "usePublicTLD" | 'additionalDomains'> &
  Pick<aws.cloudfront.DistributionArgs, "origins" | "defaultCacheBehavior" | "orderedCacheBehaviors">

export function buildCloudfrontDistribution(config: CloudfrontDistributionOptions) {
  const serviceName = getServiceName(config)
  const serviceDomain = getServiceSubdomain(config)
  const domains = getServiceDomains(config)
  const logsBucket = new aws.s3.Bucket(serviceName + "-logs", { acl: "log-delivery-write" });

  const distribution = new aws.cloudfront.Distribution(serviceName + "-cdn", {
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
    origins: config.origins,

    // A CloudFront distribution can configure different cache behaviors based on the request path.
    // Here we just specify a single, default cache behavior which is just read-only requests to S3.
    defaultCacheBehavior: config.defaultCacheBehavior,
    orderedCacheBehaviors: config.orderedCacheBehaviors,

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
    loggingConfig: {
      bucket: logsBucket.bucketDomainName,
      includeCookies: false,
      prefix: `${serviceDomain}/`,
    },
  });

  return { distribution, logsBucket }
}