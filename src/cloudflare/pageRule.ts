import { createHash } from 'crypto'
import * as cloudflare from '@pulumi/cloudflare'
import { getZoneId } from 'dcl-ops-lib/cloudflare'

function pageRuleName(service: string, target: string, ruleName: string) {
  const hash = createHash('sha256').update(target).digest('hex').slice(0, 6)
  return [ service, hash, ruleName ].join('-')
}

/**
 * Create a page rule on cloudflare that cache every thing for a year
 * and send the proper headers to user browser to cache it too
 */
export function createImmutableCachePageRule(service: string, target: string) {
  return new cloudflare.PageRule(pageRuleName(service, target, 'cache'), {
    target,
    zoneId: getZoneId(),
    actions: {
      alwaysOnline: 'on',
      cacheLevel: 'cache_everything',
      cacheTtlByStatuses: [{ codes: '200', ttl: 31536000 /* a year */ }],
      edgeCacheTtl: 31536000 /* a year */,
      browserCacheTtl: "31536000" /* a year */,
    }
  })
}


type ForwardOptions = {
  source: string,
  destination: string,
  statusCode?: 301 | 302 | 303 | 307 | 308
}

/**
 * Create a page rule on cloudflare that redirects any request matching with `target` to `destination`,
 * additionally the status code can be defined explicitly (302 as default)
 *
 * `source` and `destination` can use cloudfrony match patter
 * @see https://developers.cloudflare.com/pages/platform/redirects
 */
export function createForwardPageRule(service: string, options: ForwardOptions) {
  return new cloudflare.PageRule(pageRuleName(service, options.source, 'forward'), {
    target: options.source,
    zoneId: getZoneId(),
    actions: {
      forwardingUrl: {
        url: options.destination,
        statusCode: options.statusCode || 302,
      }
    }
  })
}