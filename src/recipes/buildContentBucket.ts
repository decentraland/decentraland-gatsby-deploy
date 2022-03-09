import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { getServiceName, getServiceSubdomain } from "../utils";
import { GatsbyOptions } from "./types";

export type ContentBucketOptions = Pick<GatsbyOptions,  'name'> &
  Pick<aws.types.input.s3.BucketWebsite, 'routingRules'> &
  {
    /**
     * The [canned ACL](https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl) to apply.
     * - **`private`**: Owner gets FULL_CONTROL. No one else has access rights (default).
     * - **`public-read`**: Owner gets FULL_CONTROL. The AllUsers group gets READ access.
     * - **`public-read-write`**: Owner gets FULL_CONTROL. The AllUsers group gets READ and WRITE access. Granting this on a bucket is generally not recommended.
     * - **`aws-exec-read`**: Owner gets FULL_CONTROL. Amazon EC2 gets READ access to GET an Amazon Machine Image (AMI) bundle from Amazon S3.
     * - **`authenticated-read`**: Owner gets FULL_CONTROL. The AuthenticatedUsers group gets READ access.
     * - **`bucket-owner-read`**: Object owner gets FULL_CONTROL. Bucket owner gets READ access. If you specify this canned ACL when creating a bucket, Amazon S3 ignores it.
     * - **`bucket-owner-full-control`**: Both the object owner and the bucket owner get FULL_CONTROL over the object. If you specify this canned ACL when creating a bucket, Amazon S3 ignores it.
     * - **`log-delivery-write`**: The LogDelivery group gets WRITE and READ_ACP permissions on the bucket. For more information about logs.
     *
     */
    acl?: pulumi.Input<'private' | 'public-read' | 'public-read-write' | 'aws-exec-read' | 'authenticated-read' | 'log-delivery-write'>,
  }

/**
 * Create a S3 bucket
 */
export function buildContentBucket(config: ContentBucketOptions) {
  const serviceName = getServiceName(config)
  const serviceDomain = getServiceSubdomain(config)
  // contentBucket is the S3 bucket that the website's contents will be stored in.
  const contentBucket = new aws.s3.Bucket(`${serviceName}-website`, {
    acl: config.acl ?? "private",

    tags: {
      Name: serviceDomain
    },

    // Configure S3 to serve bucket contents as a website. This way S3 will automatically convert
    // requests for "foo/" to "foo/index.html".
    website: {
      indexDocument: "index.html",
      errorDocument: "404.html",
      routingRules: config.routingRules
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