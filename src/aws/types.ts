/**
 * Http target options for cloudfront cache behaviors
 */
export type HttpProxyOrigin =
  /**
   * compact configuration, equivalent to:
   *
   * {
   *    endpoint: $1,
   *    minTtl: 0,
   *    defaultTtl: 0,
   *    maxTtl: 0,
   * }
   */
  | string

  /**
   * expanded configuration
   */
  | {
      /**
       * the url to the source of the content
       */
      origin: string,

      /**
       *  minimum amount of time, in seconds, that CloudFront will retain the result
       *  before sends another request to the target [default=0]
       */
      minTtl?: number,

      /**
       *  maximum amount of time, in seconds, that CloudFront will retain the result
       *  when your origin does not add HTTP headers [default=0]
       */
      maxTtl?: number,

      /**
       *  default amount of time, in seconds, that CloudFront will retain the result
       *  when your origin does not add HTTP headers [default=0]
       */
      defaultTtl?: number,
    }