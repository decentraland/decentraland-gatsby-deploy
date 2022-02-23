import type * as awsx from "@pulumi/awsx";
import type * as pulumi from "@pulumi/pulumi";

export type GatsbyOptions = {
  /**
   * Service name
   *
   * > This value will be injected as SERVICE_NAME env.
   * > SERVICE_VERSION, SERVICE_TLD, SERVICE_ORG_DOMAIN, SERVICE_DOMAIN, SERVICE_URL will be also injected
   */
  name: string;

  /**
   *
   */
  team?: "dapps" | "platform" | "data" | "marketing" | "infra",

  /**
   * Map of redirections, allows you to define file refirections and prefix redirections
   *
   * @example redirect a specific path into another path or host (only if contentSource is defined)
   *
   * >  !IMOPRTANT: in order to allow this source path must exists inside the bucket,
   * >    if the source path is s directory it must containt an `index.html` file
   *
   * ```typescript
   *    {
   *      '/': '/en/',
   *      '/me': '/en/me',
   *      '/submit': '/en/submit',
   *      '/secment.js': '/s.js',
   *      '/builder/': 'https://builder.decentraland.org/'
   *      '/builder/segment.js': 'https://builder.decentraland.org/segment.js',
   *    }
   * ```
   *
   * @example redirect all path that match with a prefix to another path or host, if target
   *  ends with `/$1` it will include the path section that match with the wildcard `/*`
   *
   * ```typescript
   *    {
   *      '/agora/*': '/dao/',
   *      '/docs/*': '/documentation/$1',
   *      '/avatars/*': 'https://builder.decentraland.org/names/',
   *      '/builder/*': 'https://builder.decentraland.org/$1'
   *    }
   * ```
   */
  contentRoutingRules?: Record<string, string>

  /**
   * Map of proxies to other url, allows you to use others domains as part of your content
   *
   * @example proxy all request from `/blog/*` to `https://blog.decentraland.io/blog/*`
   *
   * ```typescript
   *    { '/blog/*': 'https://blog.decentraland.io' }
   * ```
   *
   * @example proxy all request from `/docs/*` to `https://docs.decentraland.io/legacy/docs/*`
   *
   * ```typescript
   *    { '/docs/*': 'https://docs.decentraland.io/legacy' }
   *
   * @example add a custom ttl
   *
   * ```typescript
   *    {
   *      '/c/lambdas/*': {
   *        endpoint: 'https://peer-ec1.decentraland.org/c',
   *        minTtl: 600,
   *        defaultTtl: 3600,
   *        maxTtl: 3600,
   *      }
   *    }
   * ```
   */
  contentProxy?: Record<string, pulumi.Input<string>>

  /**
   * define a list of additional domains accepted as alias in cloufront and alb
   *
   * @default []
   */
  additionalDomains?: (string | null | undefined | false)[]

  /**
   * Docker image used to create a fargate service,
   *
   * > This value will be injected as IMAGE env
   */
  serviceImage?: string | null | undefined | false

  /**
   * Path to docker source, it will builds an image and stores it inside a amazon,
   * relative to `process.cwd()`
   *
   * > The result of the build will be injected as IMAGE env
   */
  serviceSource?: string | null | undefined | false

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * The number of instantiations of the service to place and keep running
   *
   * @default 1
   */
  serviceDesiredCount?: number

  /**
   * The number of cpu units used by the task.
   *
   * @default 256
   */
  serviceCPUs?: number

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Memory reserved to the fargare service (in MB)
   *
   * @default 256
   */
  serviceMemory?: number

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Port exposed from fargate service
   *
   * > This value will be injected as PORT env
   *
   * @default 4000
   */
  servicePort?: number

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Paths mapped from cloudfront into the fargate service
   * if `false` service will be private
   *
   * @default ["/api/*"]
   */
  servicePaths?: string[] | false

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Custom health check path, this endpoint should return a http 200 code
   *
   * @default "/api/status"
   */
  serviceHealthCheckPath?: string

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Custom metrics path, this endpoint should return a http 200 code
   *
   * @default "/metrics"
   */
  serviceMetricsPath?: string

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Adsitional environment variables exposed into the service
   */
  serviceEnvironment?: awsx.ecs.KeyValuePair[]

  /**
   * define which tld (top level domain will be used)
   * - if `true` will use `.org`, `.today`, `.zone` and `.system`
   * - if `false` will use `.co`, `.net`, `.io` and `.system`
   *
   * @default false
   */
  usePublicTLD?: boolean

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Create a bucket and inject a AWS_ACCESS_{KEY/SECRET} env with read/create access to that bucket
   *  - if `true` the bucket wont be accesible from the web
   *  - if `string[]` paths will be mapped on cloudfront
   *      @example [ '/poster/*' ] => service.decentraland.org/poster/* will map to s3.amazonaws.com/bucket/poster/*
   *
   * it can be used with others `use*` options
   *
   * > This value will be injected as AWS_BUCKET_NAME env
   *
   *  @default false
   */
  useBucket?: boolean | string[]

  /**
   * (only if `serviceImage` or `serviceSource` is defined)
   * Inject AWS_ACCESS_{KEY/SECRET} env with access to send emails
   *  - if `true` will grant access to send emails using the current domain
   *  - if `string[]` will gran access to end emails using any domain in that list
   *
   * > Note: deploy will fail if that domain is not configured in the account
   *
   * it can be used with others `use*` options
   *
   * > The first value will be injected as AWS_EMAIL_DOMAIN env
   *
   * @default false
   */
  useEmail?: boolean | string[]
};