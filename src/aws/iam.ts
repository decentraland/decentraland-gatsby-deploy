import * as aws from "@pulumi/aws";
import { all } from "@pulumi/pulumi";
import { slug } from "../utils";

/**
 * @private used to ensurte the same user name for a service
 */
function getUserName(service: string) {
  return `${service}-user`
}

/**
 * Creates a user with its corresponding role and credentials,
 * you can assing it aws resources to initeract with using the
 * user's key nad secret
 *
 * @example
 * ```typescript
 *    const access = createUser('dapp')
 *    const AWS_ACCESS_KEY = access.creds.id
 *    const AWS_ACCESS_SECRET = access.creds.secret
 * ```
 */
export function createUser(service: string) {
  const name = getUserName(service)
  const user = new aws.iam.User(name, { name });
  const creds = new aws.iam.AccessKey(name + "-key", { user: user.name });
  const role = new aws.iam.Role(`${name}-role`, {
    description: `Manage by pulumi`,
    assumeRolePolicy: user.arn.apply((arn) => {
      return aws.iam.assumeRolePolicyForPrincipal({ AWS: arn });
    }),
  });

  return {
    user,
    creds,
    role
  };
}

/**
 * Create a bucket, gives full control to `user` and make all
 * `paths` public available
 *
 * @example
 * ```typescript
 *    const access = createUser('dapp')
 *    const bucket = addBucketResource('dapp', access.user, ['/public/*'] )
 *
 *    // this key/secret pair now have full control (CRUD operation) over bucket
 *    // and anyone can access to the content inside the public directory
 *    const AWS_ACCESS_KEY = access.creds.id
 *    const AWS_ACCESS_SECRET = access.creds.secret
 * ```
 */
export function addBucketResource(service: string, user: aws.iam.User, paths: string[]) {
  const name = getUserName(service)
  const bucket = new aws.s3.Bucket(name,
    paths.length === 0 ? { acl:  "private" } : {
      acl: "public-read",
      website: { indexDocument: 'index.html' },
      corsRules: [
        {
          allowedMethods: ["GET", "HEAD"],
          exposeHeaders: ["ETag"],
          allowedOrigins: ["*"],
          maxAgeSeconds: 3600
        }
      ]
    }
  )

  new aws.s3.BucketPolicy(`${name}-bucket-policy`, {
    bucket: bucket.bucket,
    policy: all([ user.arn, bucket.bucket ]).apply(([ user, bucket]): aws.iam.PolicyDocument => ({
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
        },
        {
          "Effect": "Allow",
          "Action": ["s3:*"],
          "Principal": {
            "AWS": [user]
          },
          "Resource": [
            `arn:aws:s3:::${bucket}`,
            `arn:aws:s3:::${bucket}/*`
          ]
        }
      ]
    }))
  })

  return bucket
}

/**
 * Gives to `user` the ability to send emails with a specific domain using ses
 *
 * > !IMPORTANT `domains` should be configured inside the aws account
 *
 * @example
 * ```typescript
 *    const access = createUser('dapp')
 *    addEmailResource('dapp', access.user, ['decentraland.org'] )
 *
 *    // this key/secret pair now can send emails using `@decentraland.org`
 *    const AWS_ACCESS_KEY = access.creds.id
 *    const AWS_ACCESS_SECRET = access.creds.secret
 * ```
 */
export function addEmailResource(service: string, user: aws.iam.User, domains: string[]) {
  for (const domain of domains) {
    const name = `${getUserName(service)}-${slug(domain)}`
    const domainIdentity = new aws.ses.DomainIdentity(`${name}-identity`, { domain })
    const policyDocument = all([user.arn, domainIdentity.arn]).apply(([user, domain]) => aws.iam.getPolicyDocument({
      version: '2012-10-17',
      statements: [
        {
          effect: 'Allow',
          actions: ['ses:*'],
          resources: [domain],
          principals: [{
            identifiers: [user],
            type: "AWS",
        }]
        }
      ]
    }))

    new aws.ses.IdentityPolicy(`${name}-identity-policy`, {
      identity: domainIdentity.arn,
      policy: policyDocument.json
    })
  }

  const policy = new aws.iam.Policy(`${getUserName(service)}-ses-policy`, {
      policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [{
              Action: [ "ses:*" ],
              Effect: "Allow",
              Resource: "*"
          }]
      })
  });

  all([ user.name, policy.arn])
    .apply(([ user, policyArn ]) => new aws.iam.UserPolicyAttachment(`${getUserName(service)}-ses-attachment`, {
      policyArn,
      user,
    }));

  return true
}
