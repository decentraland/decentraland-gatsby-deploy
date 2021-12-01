import { createHash } from 'crypto'
import * as cloudflare from '@pulumi/cloudflare'
import { getZoneId } from 'dcl-ops-lib/cloudflare'

/**
 * Create a page rule on cloudflare that cache every thing for a year
 * and send the proper headers to user browser to cache it too
 */
export function createImmutableCachePageRule(service: string, target: string) {
  const hash = createHash('sha256').update(target).digest('hex')
  return new cloudflare.PageRule(`${service}-${hash.slice(0, 4)}-cache`, {
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