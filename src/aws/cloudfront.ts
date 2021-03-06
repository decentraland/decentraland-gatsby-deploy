import { all, Output } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { HttpProxyOrigin } from "./types";

export type BehaviorOptions = Pick<aws.types.input.cloudfront.DistributionOrderedCacheBehavior, 'lambdaFunctionAssociations'>

export function toDefaultBehavior(behavior: Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior>): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return behavior.apply(({ pathPattern, ...behavior }) => behavior)
}

/*******************************************************
      USING S3 BUCKETS IN A CLOUDFRONT DISTRIBUTION
 ******************************************************/

/**
 * Crates a `aws.types.input.cloudfront.DistributionOrigin` for a `aws.s3.Bucket,
 * if is listed en the `origins` prop of a `aws.cloudfront.Distribution` allows you to use
 * that bucket as a target for a request
 */
export function bucketOrigin(bucket: aws.s3.Bucket): Output<aws.types.input.cloudfront.DistributionOrigin> {
  return all([ bucket ])
  .apply(([bucket]) => all([ bucket.arn, bucket.websiteEndpoint ])
  .apply(([originId, domainName]) => ({
    originId,
    domainName,
    customOriginConfig: {
      // Amazon S3 doesn't support HTTPS connections when using an S3 bucket configured as a website endpoint.
      // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesOriginProtocolPolicy
      originProtocolPolicy: "http-only",
      httpPort: 80,
      httpsPort: 443,
      originSslProtocols: ["TLSv1.2"],
    },
  })
  ))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionOrderedCacheBehavior` using a `aws.s3.Bucket` and a `pathPatther`,
 * if is listed in the `  orderedCacheBehaviors` prop of a `aws.cloudfront.Distribution` routes all the request
 * that match `pathPattern` to the same path in `bucket` and cache the result in cloudfront for 10 minutes (600 seconds)
 *
 * > !IMPORTANT in order to use a bucket as the `orderedCacheBehaviors` prop you need to
 * > list it in the `origins` prop, please check the `bucketOrigin` function
 *
 * @param pathPattern - pattern use by cloudfront yo match request
 * @example `/unsubuscribe`: exact mathc
 * @example `/api/*`: prefixed match
 * @example `*.gif`: extension match
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesPathPattern
 */
export function staticContentBehavior(
  pathPattern: string,
  bucket: aws.s3.Bucket,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
  return all([bucket.arn ]).apply(([targetOriginId ]) => ({
    ...options,
    compress: true,
    targetOriginId,
    pathPattern,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    forwardedValues: {
      headers: [
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
        "Origin",
      ],
      cookies: { forward: "none" },
      queryString: true,
    },
    minTtl: 0,
    defaultTtl: 600,
    maxTtl: 600,
  }))
}

/**
 * Same as staticContentBehavior but cloudfront will cache the result for a whole year,
 * use this behavior for content that shoudn't change
 *
 * > !IMPORTANT in order to use a bucket as the `orderedCacheBehaviors` prop you need to
 * > list it in the `origins` prop, please check the `bucketOrigin` function
 *
 * @param pathPattern - pattern use by cloudfront yo match request
 * @example `/unsubuscribe`: exact mathc
 * @example `/api/*`: prefixed match
 * @example `*.gif`: extension match
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesPathPattern
 */
export function immutableContentBehavior(
  pathPattern: string,
  bucket: aws.s3.Bucket,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
  return all([bucket.arn]).apply(([targetOriginId]) => ({
    ...options,
    compress: true,
    targetOriginId,
    pathPattern,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],
    forwardedValues: {
      headers: [
        "Access-Control-Request-Headers",
        "Access-Control-Request-Method",
        "Origin",
      ],
      cookies: { forward: "none" },
      queryString: true,
    },
    minTtl: 1,
    defaultTtl: 86400,
    maxTtl: 31536000,
  }))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionDefaultCacheBehavior` using a `aws.s3.Bucket`.
 * if is in the `defaultCacheBehavior` prop of a `aws.cloudfront.Distribution` routes all remaining request
 * to the same path in `bucket` and cache the result in cloudfront for 10 minutes (600 seconds)
 *
 * > !IMPORTANT in order to use a bucket as the `defaultCacheBehavior` prop you need to
 * > list it in the `origins` prop, please check the `bucketOrigin` function
 */
export function defaultStaticContentBehavior(
  bucket: aws.s3.Bucket,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return toDefaultBehavior(staticContentBehavior('/*', bucket, options))
}

/******************************************************************
    USING APPLICATION LOAD BALANCERS IN A CLOUDFRONT DISTRIBUTION
 *******************************************************************/

/**
 * Crates a `aws.types.input.cloudfront.DistributionOrigin` for a `awsx.elasticloadbalancingv2.ApplicationLoadBalancer`
 * if is listed en the `origins` prop of a `aws.cloudfront.Distribution` allows you to use
 * that load balancer as a target for a request
 */
export function albOrigin(alb: awsx.elasticloadbalancingv2.ApplicationLoadBalancer): Output<aws.types.input.cloudfront.DistributionOrigin> {
  return all([ alb.loadBalancer ])
  .apply(([loadBalancer]) => all([loadBalancer.arn, loadBalancer.dnsName])
  .apply(([originId, domainName]) => ({
    originId,
    domainName,
    customOriginConfig: {
      originProtocolPolicy: "https-only",
      httpPort: 80,
      httpsPort: 443,
      originSslProtocols: ["TLSv1.2"],
    }
  })))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionOrderedCacheBehavior` using a `awsx.elasticloadbalancingv2.ApplicationLoadBalancer`
 *  and a `pathPatther`, If is listed in the `orderedCacheBehaviors` prop of a `aws.cloudfront.Distribution` routes all the request
 * that match `pathPattern` to the same path in `alb` and prevent cloudfonrt to cache the result
 *
 * > !IMPORTANT in order to use a alb as the `orderedCacheBehaviors` prop you need to
 * > list it in the `origins` prop, please check the `albOrigin` function
 *
 * @param pathPattern - pattern use by cloudfront yo match request
 * @example `/unsubuscribe`: exact mathc
 * @example `/api/*`: prefixed match
 * @example `*.gif`: extension match
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesPathPattern
 */
export function serverBehavior(
  pathPattern: string,
  alb: awsx.elasticloadbalancingv2.ApplicationLoadBalancer,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
  return all([alb.loadBalancer.arn]).apply(([targetOriginId]) => ({
    ...options,
    compress: true,
    pathPattern,
    targetOriginId,
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["HEAD", "OPTIONS", "GET", "POST", "DELETE", "PUT", "PATCH"],
    cachedMethods: ["HEAD", "OPTIONS", "GET"],
    forwardedValues: {
      headers: ["*"],
      queryString: true,
      queryStringCacheKeys: [],
      cookies: { forward: "none" },
    },
    minTtl: 0,
    defaultTtl: 0,
    maxTtl: 0
  }))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionDefaultCacheBehavior` using a `awsx.elasticloadbalancingv2.ApplicationLoadBalancer`.
 * if is in the `defaultCacheBehavior` prop of a `aws.cloudfront.Distribution` routes all remaining request
 * to the same path in `alb` and prevent cloufront to cache the result
 *
 * > !IMPORTANT in order to use a bucket as the `defaultCacheBehavior` prop you need to
 * > list it in the `origins` prop, please check the `albOrigin` function
 */
export function defaultServerBehavior(alb: awsx.elasticloadbalancingv2.ApplicationLoadBalancer): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return toDefaultBehavior(serverBehavior('/*', alb))
}

/******************************************************************
    USING HTTP ENDPOINTS IN A CLOUDFRONT DISTRIBUTION
 *******************************************************************/

/**
 * Crates a `aws.types.input.cloudfront.DistributionOrigin` for a url, if is listed en the `origins` prop
 * of a `aws.cloudfront.Distribution` allows you to use that http endpoint as a target for a request,
 * if you include a path in your endpoint all requerst will use it as a basepath, this means that if you config
 * `https://docs.decentraland.co/legacy`each time  a user request for `https://example.decentraland.org/docs/eth/index.html`
 *  cloudfront will request `https://docs.decentraland.co/legacy/docs/eth/index.html`
 */
export function httpOrigin(target: HttpProxyOrigin): Output<aws.types.input.cloudfront.DistributionOrigin> {
  const endpoint = typeof target === 'string' ? target : target.origin;
  return all([ endpoint ])
  .apply(([endpoint]) => {
      const url = new URL(endpoint)
      const hostname = url.hostname
      const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
      const distribution: aws.types.input.cloudfront.DistributionOrigin = {
        originId: hostname + pathname,
        domainName: hostname,
        customOriginConfig: {
          originProtocolPolicy: url.protocol === 'https:' ? 'https-only' : 'http-only',
          httpPort: 80,
          httpsPort: 443,
          originSslProtocols: ["TLSv1.2"],
        }
      }

      if (pathname) {
        distribution.originPath = url.pathname
      }

      return distribution
  })
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionOrderedCacheBehavior` using an url and a `pathPatther`,
 * If is listed in the `orderedCacheBehaviors` prop of a `aws.cloudfront.Distribution` routes all the request
 * that match `pathPattern` to the same path in the endpoint and prevent cloudfonrt to cache the result
 *
 * > !IMPORTANT you can use a path in yout endpoint and it will be used as a basepath,
 * > please check the `httpOrigin` function
 *
 * > !IMPORTANT in order to use a alb as the `orderedCacheBehaviors` prop you need to
 * > list it in the `origins` prop, please check the `httpOrigin` function
 *
 * @param pathPattern - pattern use by cloudfront yo match request
 * @example `/unsubuscribe`: exact mathc
 * @example `/api/*`: prefixed match
 * @example `*.gif`: extension match
 * @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesPathPattern
 */
export function httpProxyBehavior(
  pathPattern: string,
  target: HttpProxyOrigin,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
  const endpoint = typeof target === 'string' ? target : target.origin;
  const minTtl = typeof target === 'string' ? 0 : target.minTtl || 0;
  const defaultTtl = typeof target === 'string' ? 0 : target.defaultTtl || 0;
  const maxTtl = typeof target === 'string' ? 0 : target.maxTtl || 0;

  return all([endpoint]).apply(([endpoint]) => {
    const url = new URL(endpoint)
    const hostname = url.hostname
    const pathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
    return {
      ...options,
      compress: true,
      pathPattern,
      targetOriginId: hostname + pathname,
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["HEAD", "OPTIONS", "GET", "POST", "DELETE", "PUT", "PATCH"],
      cachedMethods: ["HEAD", "OPTIONS", "GET"],
      forwardedValues: {
        headers: [
          "Access-Control-Request-Headers",
          "Access-Control-Request-Method",
          "Origin",
        ],
        queryString: true,
        queryStringCacheKeys: [],
        cookies: { forward: "none" },
      },
      minTtl,
      defaultTtl,
      maxTtl
    }
  })
}
