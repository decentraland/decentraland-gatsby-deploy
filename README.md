# decentraland-gatsby-deploy

Toolbox collections to create pipeline deploys using pulumi (build on top of [dcl-ops-lib](https://www.npmjs.com/package/dcl-ops-lib))

## Index

- [API](#api)
- [CLIs](#clis)

## API

Our api are separated in two categories

- the recipes: that are ways to build a stand-alone service that can be combined
- the platform abstraction: that are simplified ways to configure a platform

### [`buildContentBucket`](./src/recipes/buildContentBucket.ts) recipe

Creates a [S3 bucket](https://aws.amazon.com/s3/).

| params         | type                               | description |
|----------------|------------------------------------|-------------|
| `name`         | `string`                           | define the name of the services **`[required]`** |
| `acl`          | `pulumi.Input<string>`             | the [canned ACL](https://docs.aws.amazon.com/AmazonS3/latest/dev/acl-overview.html#canned-acl) to apply.  |
| `routingRules` | `pulumi.Input<aws.s3.RoutingRule>` | A json array containing [routing rules](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration-routingrules.html) describing redirect behavior and when redirects are applied. |

> You can use `createRoutingRules` to simplify the `routingRules` definition

| return                 | type                    | description                 |
|------------------------|-------------------------|-----------------------------|
|                        | `Object                 | bucket definitions          |
| `.bucketName`          | `pulumi.Output<string>` | bucket name                 |
| `.contentBucket`       | `aws.s3.Bucket`         | bucket configuration        |
| `.contentBucketPolicy` | `aws.s3.BucketPolicy`   | bucket policy configuration |

### [`buildCloudfrontDistribution`](./src/recipes/buildCloudfrontDistribution.ts) recipe

Creates a [Cloudfront Distribution](https://aws.amazon.com/cloudfront/)

| params                     | type       | description |
|----------------------------|------------|-------------|
| `config`                   | `Object`   |             |
| `config.name`              | `string`   | define the name of the services **`[required]`**                        |
| `config.usePublicTLD`      | `boolean`  | defines is the distribution will response to request for the public tld |
| `config.additionalDomains` | `string[]` | defines the list of domains                                             |
| `config.origins` | `pulumi.Input<pulumi.Input<inputs.cloudfront.DistributionOrigin>[]>;` | one or more [origins](https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_Origin.html) for this distribution. |
| `config.orderedCacheBehaviors` | `pulumi.Input<pulumi.Input<inputs.cloudfront.DistributionOrderedCacheBehavior>[]>` | an ordered list of cache behaviors resource for this distribution. |
| `config.defaultCacheBehavior` | `pulumi.Input<inputs.cloudfront.DistributionDefaultCacheBehavior>` | the default cache behavior for this distribution **`[required]`** |

| return          | type                          | description                  |
|-----------------|-------------------------------|------------------------------|
|                 | `Object`                      | cloudfront definitions       |
| `.distribution` | `aws.cloudfront.Distribution` | distribution definition      |
| `.logsBucket`   | `aws.s3.Bucket`               | bucket for [access logs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html)  |

### [`routeToCloudfrontDistribution`](./src/recipes/buildCloudfrontDistribution.ts) recipe

Route a domain into a Cloudfront Distribution

| params          | type                                                                | description         |
|-----------------|---------------------------------------------------------------------|---------------------|
| `domains`       | `string[]`                                                          | domain list         |
| `distribution`  | `Pick<aws.cloudfront.Distribution, "domainName" \| "hostedZoneId">` | distribution target |

| returns  | type                                         | description             |
|----------|----------------------------------------------|-------------------------|
|          | `(aws.route53.Record | cloudflare.Record)[]` | list of records created |

### [`routeToLoadBalancer`](./src/recipes/buildCloudfrontDistribution.ts) recipe

Route a domain into a aws Load Balancer

| params          | type                                              | description          |
|-----------------|---------------------------------------------------|----------------------|
| `domains`       | `string[]                                         | domain list          |
| `distribution`  | `Pick<aws.lb.LoadBalancer, "dnsName" | "zoneId">` | load balancer target |

| returns  | type                                         | description             |
|----------|----------------------------------------------|-------------------------|
|          | `(aws.route53.Record | cloudflare.Record)[]` | list of records created |

## CLIs

- `download-release`: download assets from a github release
- `generate-statics`: generate static version of files
- `setup-bucket`: *@deprecated* use [`cdn-uploader`](https://github.com/decentraland/cdn-uploader) instead.
- `setup-environment`: read pulumi configuration and load all public configuration as environment variables
- `setup-stack`: select a pulumi stack or create it if doesn't exists
