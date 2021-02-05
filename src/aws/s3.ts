import * as aws from '@pulumi/aws'

export function routingRules(redirects: Record<string, string> = {}): aws.s3.RoutingRule[] {
  return Object.keys(redirects)
    .filter((origin) => origin.endsWith('/*'))
    .map((origin) => {
      const target = redirects[origin]
      const KeyPrefixEquals = origin.slice(1, -2)
      const Condition: aws.s3.Condition = { KeyPrefixEquals }
      const Redirect: aws.s3.Redirect = {}
      let path = target

      if (target.startsWith('https://') || target.startsWith('http://')) {
        const url = new URL(target)
        Redirect.Protocol = url.protocol === 'https:' ? 'https' : 'http'
        Redirect.HostName = url.hostname
        path = url.pathname
      }

      if (path.endsWith('/$1')) {
        Redirect.ReplaceKeyPrefixWith = path.slice(1, -2)
      } else {
        Redirect.ReplaceKeyWith = path.slice(1)
      }

      return { Condition, Redirect }
    })
}
