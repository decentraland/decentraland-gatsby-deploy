// @ts-check

/**
 * @typedef {Record<string,{ key: string, value: string }[]>} Headers
 */

/**
 * @typedef {{ Records: ResponseViewerEventRecord[] }} ResponseViewerEvent
 */

/**
 * @typedef {{ cf: ResponseViewerEventData }} ResponseViewerEventRecord
 */

/**
 * @typedef {Object} ResponseViewerEventData
 * @property {Object} config
 * @property {string} config.distributionDomainName
 * @property {string} config.distributionId
 * @property {string} config.eventType
 * @property {string} config.requestId
 * @property {Object} request
 * @property {string} request.clientIp
 * @property {Headers} request.headers
 * @property {string} request.method
 * @property {string} request.querystring
 * @property {string} request.uri
 * @property {ResponseHttpEvent} response
 */

/**
 * @typedef {Object} ResponseHttpEvent
 * @property {Headers} headers
 * @property {string} status
 * @property {string} statusDescription
 */

/**
 * @param {ResponseViewerEvent} event
 * @param {any} _context
 * @param {(err: Error | null, response?: ResponseHttpEvent) => void} callback
 */
exports.handler = function (event, _context, callback) {
  // Get contents of response
  const data = event.Records[0].cf
  const request = data.request;
  const response = data.response;

  const host = (request.headers['host'] || [ { key: 'Host', value: null } ])[0].value
  const uri = request.uri || ''
  const tld = host.split('.').slice(-2).join('.')
  const scriptPolicies = Array.from(new Set([
    `'self'`,
    `'unsafe-inline'`,
    `'unsafe-eval'`,
    `https://${tld}`,
    `https://*.${tld}`,
    'https://decentraland.org',
    'https://*.decentraland.org',
    'https://www.google-analytics.com',
    'https://ajax.cloudflare.com',
    'https://hcaptcha.com',
    'https://newassets.hcaptcha.com',
    'https://cdn.segment.com',
    'https://cdn.rollbar.com',
    'https://www.googletagmanager.com',
    'https://tagmanager.google.com',
    'https://www.google-analytics.com',
    'https://ssl.google-analytics.com',
    'https://www.googleadservices.com',
    'https://googleads.g.doubleclick.net',
    'https://www.google.com',
    // 'https://a.klaviyo.com', deprecated
    // 'https://widget.intercom.io', disabled
    // 'https://js.intercomcdn.com', disabled
    // 'https://connect.facebook.net', deprecated
  ])).join(' ')

  /**
   * @param {string} key
   * @param {string} value
   */
  function setHeader(key, value) {
    const rawKey = key.toLowerCase()
    if (!response.headers[rawKey]) {
      response.headers[rawKey] = [{ key, value }]
    }
  }

  // Set static headers
  setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubdomains; preload')
  setHeader('X-Content-Type-Options', 'nosniff')
  setHeader('X-Frame-Options', 'DENY')
  setHeader('X-XSS-Protection', '1; mode=block')
  setHeader('Referrer-Policy', 'no-referrer, strict-origin-when-cross-origin')
  setHeader('Content-Security-Policy', getContentSecurityPolicy(scriptPolicies))

  if (isPublicAvailable(uri)) {
    setHeader('Access-Control-Allow-Origin', '*')
    setHeader('Access-Control-Allow-Headers', 'Content-Type')
    setHeader('Access-Control-Allow-Methods', 'OPTIONS,HEAD,GET')
  }

  callback(null, response)
}

const publicExtensions = [
  // data
  '.json', '.xml', '.csv', '.txt',

  // images
  '.png', '.apng', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'
]

/**
 * @param {string} uri
 * @returns boolean
 */
function isPublicAvailable(uri) {
  return publicExtensions.some((ext) => uri.endsWith(ext)) ||
    uri.startsWith('/.well-known/')
}

const defaultContentSecurityPolicy = [
  `default-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `manifest-src 'self'`,
  `media-src 'self'`,
  `worker-src 'self'`,
  `font-src https: data:`,
  `prefetch-src https: data:`,
  `style-src 'unsafe-inline' https: data:`,
  `img-src https: data:`,
  `connect-src https:`,
  `frame-src https:`,
  `child-src https:`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
].join('; ')

function getContentSecurityPolicy(scriptPolicy) {
  return defaultContentSecurityPolicy + '; script-src ' +scriptPolicy
}