import { all, Output, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export type BehaviorOptions = Pick<
  aws.types.input.cloudfront.DistributionOrderedCacheBehavior,
  | 'lambdaFunctionAssociations'
  | 'functionAssociations'
  | 'originRequestPolicyId'
  | 'responseHeadersPolicyId'
  | 'minTtl'
  | 'defaultTtl'
  | 'maxTtl'
>

export function toDefaultBehavior(behavior: Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior>): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return behavior.apply(({ pathPattern, ...behavior }) => behavior)
}

export function uniqueOrigins(origins: aws.types.input.cloudfront.DistributionOrigin[]) {
  return all(origins.map(origin => origin.originId))
    .apply((originIds) => {
      const alreadyUseOrigins = new Set<string>()
      return originIds
        .map((originId: string, index: number) => {
          if (alreadyUseOrigins.has(originId)) {
            return null
          }

          alreadyUseOrigins.add(originId)
          return origins[index]
        })
        .filter(Boolean) as aws.types.input.cloudfront.DistributionOrigin[]
    })
}

/*******************************************************
            SECURITY HEADER CONFIGURATION
*******************************************************/

export type SecurityHeadersOptions = Partial<{
  accessControlAllowCredentials: boolean
  accessControlAllowOrigins: string[],
  accessControlAllowHeaders: string[],
  accessControlAllowMethods: ("OPTIONS" | "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE")[],
  contentSecurityPolicyScript: string[],
  permissonPolicy: Partial<PermissionPolicyOptions>
}>

export type PermissionPolicyOptions = {
  // Standardized Features
  /** The Accelerometer interface of the Sensor APIs provides on each reading the acceleration applied to the device along all three axes. */
  "accelerometer": boolean | '*' | string[]

  /** The AmbientLightSensor interface of the Sensor APIs returns the current light level or illuminance of the ambient light around the hosting device. */
  "ambient-light-sensor": boolean | '*' | string[]

  /** Controls the ability to have Media (Audio or Video) elements begin playback without user interaction in the current document. When this policy is disabled and there were no user gestures, the Promise returned by HTMLMediaElement.play() will reject with a DOMException. The autoplay attribute on <audio> and <video> elements will be ignored. */
  "autoplay": boolean | '*' | string[]

  /** The Battery Status API can be used to defer or scale back work when the device is not charging in or is low on battery. */
  "battery": boolean | '*' | string[]

  /** Manages access to Camera interfaces (physical and virtual). */
  "camera": boolean | '*' | string[]

  /** Cross-origin isolation enables a web page to use powerful features such as SharedArrayBuffer, performance.measureUserAgentSpecificMemory(), high resolution timer with better precision, or the JS Self-Profiling API. This also impacts the "document-domain" permission when set (see below). */
  "cross-origin-isolated": boolean | '*' | string[]

  /** A document's permissions policy determines whether any content in that document is allowed to use getDisplayMedia. */
  "display-capture": boolean | '*' | string[]

  /** Provides access to the deprecated "document.domain[=domain]" setter. When the "document-domain" feature is disabled, the setter will throw a "SecurityError" exception. In cases where crossOriginIsolated or originAgentCluster return true, the setter will do nothing. It is recommended to avoid using the document.domain setter, instead, use postMessage() or MessageChannel objects to communicate across origins in a safe manner. */
  "document-domain": boolean | '*' | string[]

  /** Encrypted Media Extensions provides an API that enables web applications to interact with content protection systems, to allow playback of encrypted audio and video. Provides access to the requestMediaKeySystemAccess() method, a part of the MediaKeys object. */
  "encrypted-media": boolean | '*' | string[]

  /** Controls if tasks should execute for nested browsing contexts (eg. iframes) when it has/is not being rendered. */
  "execution-while-not-rendered": boolean | '*' | string[]

  /** Controls if tasks should execute for nested browsing contexts (eg. iframes) when not within the current viewport. */
  "execution-while-out-of-viewport": boolean | '*' | string[]

  /** Determines whether any content in a document is allowed to go fullscreen. If disabled in any document, no content in the document will be allowed to use fullscreen. */
  "fullscreen": boolean | '*' | string[]

  /** The Geolocation API provides access to geographical location information associated with the host device. */
  "geolocation": boolean | '*' | string[]

  /** Gyroscope sensor interface to monitor the rate of rotation around the three local primary axes of the device. */
  "gyroscope": boolean | '*' | string[]

  /** Controls whether the getLayoutMap() method is exposed on the "Keyboard" interface. */
  "keyboard-map": boolean | '*' | string[]

  /** Magnetometer sensor interface to measure a magnetic field in the X, Y and Z axis. */
  "magnetometer": boolean | '*' | string[]

  /** Manages access to Microphone interfaces (physical and virtual). */
  "microphone": boolean | '*' | string[]

  /** Musical Instrument Digital Interface (MIDI) protocol enables electronic musical instruments, controllers and computers to communicate and synchronize with each other. */
  "midi": boolean | '*' | string[]

  /** Enables the page author to take control over the behavior of spatial navigation, or to cancel it outright. Spatial navigation is the ability to move around the page directionally which can be useful for a web page built using a grid-like layout, or other predominantly non linear layouts. More often this is used in browsers on devices with limited input control, such as a TV. */
  "navigation-override": boolean | '*' | string[]

  /** Allow merchants (i.e. web sites selling physical or digital goods) to utilise one or more payment methods with minimal integration. */
  "payment": boolean | '*' | string[]

  /** Allow websites to create a floating video window always on top of other windows so that users may continue consuming media while they interact with other content sites, or applications on their device. This item controls whether the request Picture-in-Picture algorithm may return a SecurityError and whether pictureInPictureEnabled is true or false. */
  "picture-in-picture": boolean | '*' | string[]

  /** Determines whether any content in the allowed documents is allowed to successfully invoke the Web Authentication API. If disabled in any document, no content in the document will be allowed to use the foregoing methods, attempting to do so will return an error. */
  "publickey-credentials-get": boolean | '*' | string[]

  /** A screen wake lock prevents the screen from turning off. Only visible documents can acquire the screen wake lock. */
  "screen-wake-lock": boolean | '*' | string[]

  /** The sync-xhr policy controls whether synchronous requests can be made through the XMLHttpRequest API. If disallowed in a document, then calls to send() on XMLHttpRequest objects with the synchronous flag set will fail, causing a NetworkError DOMException to be thrown. */
  "sync-xhr": boolean | '*' | string[]

  /** The WebUSB API provides a way to safely expose USB device services to the web. Controls whether the usb attribute is exposed on the Navigator object. */
  "usb": boolean | '*' | string[]

  /** Exposes the navigator.share() API where supported, which shares the current URL via user agent provided share to locations. */
  "web-share": boolean | '*' | string[]

  /** The WebXR Device API provides the interfaces necessary to enable developers to build compelling, comfortable, and safe immersive applications on the web across a wide variety of hardware form factors. */
  "xr-spatial-tracking": boolean | '*' | string[]

  // Proposed Features

  /** Read from the device clipboard via the Clipboard API */
  "clipboard-read": boolean | '*' | string[]

  /** Write to the device clipboard via the Clipboard API */
  "clipboard-write": boolean | '*' | string[]

  /** Determines whether any content in that document is allowed to access getGamepads(). If disabled in any document, no content in the document will be allowed to use getGamepads(), nor will the "gamepadconnected" and "gamepaddisconnected" events fire. */
  "gamepad": boolean | '*' | string[]

  /** Determines whether any content in a document is allowed to use the selectAudioOutput function to prompt the user to select an audio output device, or allowed to use setSinkId to change the device through which audio output should be rendered, to a non-system-default user-permitted device. */
  "speaker-selection": boolean | '*' | string[]

  // Experimental Features
  /** Click Through Attribution Reporting. To enable this, use the Chrome command line flag --enable-blink-features=ConversionMeasurement */
  "conversion-measurement": boolean | '*' | string[]

  /** Helps control the use of automated focus in a main frame or <iframe>. The proposed feature provides a means for developers to block the use of automatic focus in nested contents. */
  "focus-without-user-activation": boolean | '*' | string[]

  /** Allow a web page to communicate with HID devices (Human Interface Device) */
  "hid": boolean | '*' | string[]

  /** Allow usage of the IdleDetector interface to better detect if a user is at their device, instead of trying to identify if a user has just become inactive, such as left window open, screen saver activated, screen turned off, changed tabs or changed applications. */
  "idle-detection": boolean | '*' | string[]

  /** [Obsolete] A site can forbid topic calculation on a page by disabling the interest-cohort. The Topics API replaced Federated Learning of Cohorts (FLoC) which is what this was for, however the Topics API honors the disable setting. The intent of the Topics API is to provide callers (including third-party ad-tech or advertising providers on the page that run scripts) with coarse-grained advertising topics that the page visitor might currently be interested in. */
  "interest-cohort": boolean | '*' | string[]

  /** Provide direct communication between a web site and the device that it is controlling via a Serial port. To enable this, use the Chrome command line flag --enable-blink-features=Serial */
  "serial": boolean | '*' | string[]

  /** Unknown - No information currently available. To enable this, use the Chrome command line flag --enable-blink-features=ExperimentalProductivityFeatures. */
  "sync-script": boolean | '*' | string[]

  /** This API proposes a new per-origin storage area for “Privacy Pass” style cryptographic tokens, which are accessible in third party contexts. These tokens are non-personalized and cannot be used to track users, but are cryptographically signed so they cannot be forged. */
  "trust-token-redemption": boolean | '*' | string[]

  /** Proposal to provide additional informatiion for Multi-Screen Window Placement. */
  "window-placement": boolean | '*' | string[]

  /** Vertical scroll policy is a feature introduced to assist websites in blocking certain embedded contents from interfering with vertical scrolling. Stopping a user from vertically scrolling the page might be a frustrating experience. */
  "vertical-scroll": boolean | '*' | string[]
}


export const ContentSecurityPolicyScript = {
  DeveloperTools: [
    'https://cdn.segment.com',
    'https://cdn.rollbar.com',
    'https://ajax.cloudflare.com',
  ],

  HCaptcha: [
    'https://hcaptcha.com',
    'https://newassets.hcaptcha.com',
  ],

  Intercom: [
    'https://widget.intercom.io',
    'https://js.intercomcdn.com',
  ],

  GoogleAnalytics: [
    'https://googleads.g.doubleclick.net',
    'https://ssl.google-analytics.com',
    'https://tagmanager.google.com',
    'https://www.google-analytics.com',
    'https://www.google-analytics.com',
    'https://www.google.com',
    'https://www.googleadservices.com',
    'https://www.googletagmanager.com',
  ],
}

function toPermissionPolicy(options: Partial<PermissionPolicyOptions> = {}): string {
  return Object.keys(options).map(key => {
    const value = options[key] as boolean | '*' | string[]
    switch (value) {
      case false:
        return key + '=()'
      case true:
        return key + '=(self)'
      case '*':
        return key + '=*'
      default:
        return key + '=(' + value.map(domain => `"${domain}"`).join(' ') + ')'
    }
  }).join(', ')
}

export const PermissionPolicies = {
  Self: {
    "accelerometer": true,
    "ambient-light-sensor": true,
    "autoplay": true,
    "battery": true,
    "camera": true,
    "cross-origin-isolated": true,
    "display-capture": true,
    "document-domain": true,
    "encrypted-media": true,
    "execution-while-not-rendered": true,
    "execution-while-out-of-viewport": true,
    "fullscreen": true,
    "geolocation": true,
    "gyroscope": true,
    "keyboard-map": true,
    "magnetometer": true,
    "microphone": true,
    "midi": true,
    "navigation-override": true,
    "payment": true,
    "picture-in-picture": true,
    "publickey-credentials-get": true,
    "screen-wake-lock": true,
    "sync-xhr": true,
    "usb": true,
    "web-share": true,
    "xr-spatial-tracking": true,
    "clipboard-read": true,
    "clipboard-write": true,
    "gamepad": true,
    "speaker-selection": true,
    "conversion-measurement": true,
    "focus-without-user-activation": true,
    "hid": true,
    "idle-detection": true,
    "interest-cohort": true,
    "serial": true,
    "sync-script": true,
    "trust-token-redemption": true,
    "window-placement": true,
    "vertical-scroll": true,
  } as PermissionPolicyOptions,

  Restricted: {
    "accelerometer": false,
    "ambient-light-sensor": false,
    "autoplay": false,
    "battery": false,
    "camera": false,
    "cross-origin-isolated": false,
    "display-capture": false,
    "document-domain": false,
    "encrypted-media": false,
    "execution-while-not-rendered": false,
    "execution-while-out-of-viewport": false,
    "fullscreen": false,
    "geolocation": false,
    "gyroscope": false,
    "keyboard-map": false,
    "magnetometer": false,
    "microphone": false,
    "midi": false,
    "navigation-override": false,
    "payment": false,
    "picture-in-picture": false,
    "publickey-credentials-get": false,
    "screen-wake-lock": false,
    "sync-xhr": false,
    "usb": false,
    "web-share": false,
    "xr-spatial-tracking": false,
    "clipboard-read": false,
    "clipboard-write": false,
    "gamepad": false,
    "speaker-selection": false,
    "conversion-measurement": false,
    "focus-without-user-activation": false,
    "hid": false,
    "idle-detection": false,
    "interest-cohort": false,
    "serial": false,
    "sync-script": false,
    "trust-token-redemption": false,
    "window-placement": false,
    "vertical-scroll": false,
  } as PermissionPolicyOptions,
}

/**
 * Create a aws.cloudfront.ResponseHeadersPolicy instance
 */
export function staticSecurityHeadersPolicy(serviceName: string, options: SecurityHeadersOptions = {}) {
  return new aws.cloudfront.ResponseHeadersPolicy(`${serviceName}-security-headers`, {
    comment: "Security headers for static files",
    /**
     * CORS Header injection
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
     */
    corsConfig: {
      originOverride: false,

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials */
      accessControlAllowCredentials: options.accessControlAllowCredentials ?? false,

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin */
      accessControlAllowOrigins: {
        items: options.accessControlAllowOrigins ?? ["*"]
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers */
      accessControlAllowHeaders: {
        items: options.accessControlAllowHeaders ?? ["Content-Type"]
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Methods */
      accessControlAllowMethods: {
        items: options.accessControlAllowMethods ?? ["OPTIONS","HEAD","GET"]
      },
    },

    securityHeadersConfig: {

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security */
      strictTransportSecurity: {
        override: true,
        accessControlMaxAgeSec: 63072000,
        includeSubdomains: true,
        preload: true
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options */
      contentTypeOptions: {
        override: true
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options */
      frameOptions: {
        override: true,
        frameOption: 'DENY'
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection */
      xssProtection: {
        override: true,
        modeBlock: true,
        protection: true,
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy */
      referrerPolicy: {
        override: true,
        referrerPolicy: 'strict-origin-when-cross-origin'
      },

      /** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy */
      contentSecurityPolicy: {
        override: true,
        contentSecurityPolicy: [
          `base-uri 'self'`,
          `child-src https:`,
          `connect-src https:`,
          `default-src 'none'`,
          `font-src https: data:`,
          `form-action 'self'`,
          `frame-ancestors 'none'`,
          `frame-src https:`,
          `img-src https: data:`,
          `manifest-src 'self'`,
          `media-src 'self'`,
          `object-src 'none'`,
          `prefetch-src https: data:`,
          `style-src 'unsafe-inline' https: data:`,
          `worker-src 'self'`,
          `script-src ` + [
            `'self'`,
            `'unsafe-inline'`,
            `'unsafe-eval'`,

            // decentraland production
            'https://decentraland.org',
            'https://*.decentraland.org',

            ...(options.contentSecurityPolicyScript || []),
            ...ContentSecurityPolicyScript.DeveloperTools,
            ...ContentSecurityPolicyScript.GoogleAnalytics,
          ].join(' ')
        ].join('; ')
      }
    },

    customHeadersConfig: {
      items: [
        options.permissonPolicy && {
          override: false,
          header: 'Permissions-Policy',
          value: toPermissionPolicy(options.permissonPolicy)
        }
      ].filter(Boolean) as aws.types.input.cloudfront.ResponseHeadersPolicyCustomHeadersConfigItem[]
    }
  })
}

/*******************************************************
      USING S3 BUCKETS IN A CLOUDFRONT DISTRIBUTION
 ******************************************************/

/**
 * Crates a `aws.types.input.cloudfront.DistributionOrigin` for a `aws.s3.Bucket,
 * if is listed en the `origins` prop of a `aws.cloudfront.Distribution` allows you to use
 * that bucket as a target for a request
 */
export function bucketOrigin(bucket: Pick<aws.s3.Bucket, "arn" | "websiteEndpoint">): Output<aws.types.input.cloudfront.DistributionOrigin> {
  return all([bucket.arn, bucket.websiteEndpoint])
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
    )
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
  bucket: Pick<aws.s3.Bucket, "arn">,
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
    minTtl: options.minTtl ?? 120,
    defaultTtl: options.defaultTtl ?? 120,
    maxTtl: options.maxTtl ?? 31536000,
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
  bucket: Pick<aws.s3.Bucket, "arn">,
  options: Omit<BehaviorOptions, "minTtl" | "defaultTtl" | "maxTtl"> = {}
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
    minTtl: 86400,
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
  bucket: Pick<aws.s3.Bucket, "arn">,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return toDefaultBehavior(staticContentBehavior('/*', bucket, options))
}

/******************************************************************
    USING APPLICATION LOAD BALANCERS IN A CLOUDFRONT DISTRIBUTION
 *******************************************************************/

/**
 * Crates a `aws.types.input.cloudfront.DistributionOrigin` for a `aws.lb.LoadBalancer`
 * if is listed en the `origins` prop of a `aws.cloudfront.Distribution` allows you to use
 * that load balancer as a target for a request
 */
export function albOrigin(loadBalancer: Pick<aws.lb.LoadBalancer, "arn" | "dnsName">): Output<aws.types.input.cloudfront.DistributionOrigin> {
  return all([loadBalancer.arn, loadBalancer.dnsName])
    .apply(([originId, domainName]) => ({
      originId,
      domainName,
      customOriginConfig: {
        originProtocolPolicy: "https-only",
        httpPort: 80,
        httpsPort: 443,
        originSslProtocols: ["TLSv1.2"],
      }
    }))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionOrderedCacheBehavior` using a `aws.lb.LoadBalancer`
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
  loadBalancer: Pick<aws.lb.LoadBalancer, "arn">,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
  return all([loadBalancer.arn]).apply(([targetOriginId]) => ({
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
    minTtl: options.minTtl ?? 0,
    defaultTtl: options.defaultTtl ?? 0,
    maxTtl: options.maxTtl ?? 31536000,
  }))
}

/**
 * Creates a `aws.types.input.cloudfront.DistributionDefaultCacheBehavior` using a `aws.lb.LoadBalancer`.
 * if is in the `defaultCacheBehavior` prop of a `aws.cloudfront.Distribution` routes all remaining request
 * to the same path in `alb` and prevent cloufront to cache the result
 *
 * > !IMPORTANT in order to use a bucket as the `defaultCacheBehavior` prop you need to
 * > list it in the `origins` prop, please check the `albOrigin` function
 */
export function defaultServerBehavior(loadBalancer: Pick<aws.lb.LoadBalancer, "arn">): Output<aws.types.input.cloudfront.DistributionDefaultCacheBehavior> {
  return toDefaultBehavior(serverBehavior('/*', loadBalancer))
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
export function httpOrigin(endpoint: Input<string>): Output<aws.types.input.cloudfront.DistributionOrigin> {
  return all([endpoint])
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
  endpoint: Input<string>,
  options: BehaviorOptions = {}
): Output<aws.types.input.cloudfront.DistributionOrderedCacheBehavior> {
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
      minTtl: 0,
      defaultTtl: 0,
      maxTtl: 31536000,
    }
  })
}
