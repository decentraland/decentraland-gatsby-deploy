import * as aws from "@pulumi/aws";
import { routingRules } from "../aws/s3";
import { getServiceName, getServiceSubdomain } from "../utils";
import { GatsbyOptions } from "./types";

export function buildContentBucket(config: Pick<GatsbyOptions,  'name' | 'usePublicTLD' | 'contentRoutingRules'>) {
  const serviceName = getServiceName(config)
  const serviceDomain = getServiceSubdomain(config)
  const contentRoutingRules = routingRules(config.contentRoutingRules, { hostname: serviceDomain, protocol: 'https' })
  // contentBucket is the S3 bucket that the website's contents will be stored in.
  const contentBucket = new aws.s3.Bucket(`${serviceName}-website`, {
    acl: "private",

    tags: {
      Name: serviceDomain
    },

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
      indexDocument: "index.html",
      errorDocument: "404.html",
      ...(contentRoutingRules.length > 0 && { routingRules: contentRoutingRules })
    },

    corsRules: [
      {
        allowedMethods: ["GET", "HEAD"],
        exposeHeaders: ["ETag"],
        allowedOrigins: ["*"],
        maxAgeSeconds: 3600
      }
    ]
  });

  const contentBucketPolicy = new aws.s3.BucketPolicy(`${serviceName}-website-bucket-policy`, {
    bucket: contentBucket.bucket,
    policy: contentBucket.bucket.apply((bucket): aws.iam.PolicyDocument => ({
      "Version": "2012-10-17",
      "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                `arn:aws:s3:::${bucket}/*`
            ]
        }
      ]
    }))
  })

  return { bucketName: contentBucket.bucket, contentBucket, contentBucketPolicy }
}