import * as aws from '@pulumi/aws'

/**
 * Create a list of RouteingRule from a Map
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
 * results in
 *
 * ```typescript
 *    [
 *      {
 *        Condition: { KeyPrefixEquals: "agora/" },
 *        Redirect: { ReplaceKeyWith: "dao/" }
 *      },
 *      {
 *        Condition: { KeyPrefixEquals: "docs/" },
 *        Redirect: { ReplaceKeyPrefixWith: "documentation/" }
 *      },
 *      {
 *        Condition: { KeyPrefixEquals: "avatars/" },
 *        Redirect: { Protocol: "https", HostName: "builder.decentraland.org",  ReplaceKeyWith: "names/" }
 *      },
 *      {
 *        Condition: { KeyPrefixEquals: "builder/" },
 *        Redirect: { Protocol: "https", HostName: "builder.decentraland.org",  ReplaceKeyPrefixWith: "" }
 *      },
 *    ]
 * ```
 */
export function routingRules(redirects: Record<string, string> = {}, options: { hostname?: string, protocol?: 'https' | 'http' } = {}): aws.s3.RoutingRule[] {
  return Object.keys(redirects)
    .filter((origin) =>{
      return origin.startsWith('/') && origin.endsWith('/*') && (
        redirects[origin].startsWith('/') ||
        redirects[origin].startsWith('http://') ||
        redirects[origin].startsWith('https://')
      )
    })
    .map((origin) => {
      const target = redirects[origin]
      const KeyPrefixEquals = origin.slice(1, -1)
      const Condition: aws.s3.Condition = { KeyPrefixEquals }
      const Redirect: aws.s3.Redirect = {}
      let path = target

      if (target.startsWith('https://') || target.startsWith('http://')) {
        const url = new URL(target)
        Redirect.Protocol = url.protocol === 'https:' ? 'https' : 'http'
        Redirect.HostName = url.hostname
        path = url.pathname
      } else {
        if (options.hostname) {
          Redirect.HostName = options.hostname
        }

        if (options.protocol) {
          Redirect.Protocol = options.protocol
        }
      }

      if (path.endsWith('/$1')) {
        Redirect.ReplaceKeyPrefixWith = path.slice(1, -2)
      } else {
        Redirect.ReplaceKeyWith = path.slice(1)
      }

      return { Condition, Redirect }
    })
}
