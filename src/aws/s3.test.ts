import { createRoutingRules } from './s3'

describe(`src/aws/s3`, () => {
  describe(`routingRules`, () => {

    test(`should accept an empty map`, () => {
      expect(createRoutingRules()).toEqual([])
      expect(createRoutingRules({})).toEqual([])
      expect(createRoutingRules({}, { hostname: 'example.com' })).toEqual([])
      expect(createRoutingRules({}, { hostname: 'example.com', protocol: 'https' })).toEqual([])
    })

    test(`should ignore invalid maps key`, () => {
      const map = {
          'invalid': '/path/',
          'invalid/*': '/path/',
          'invalid/': '/path/',
          '/path1/*': 'invalid/',
          '/path2/*': 'invalid/*',
          '/pat3/*': 'invalid/$1',
      }

      expect(createRoutingRules(map)).toEqual([])
      expect(createRoutingRules(map, { hostname: 'example.com' })).toEqual([])
      expect(createRoutingRules(map, { hostname: 'example.com', protocol: 'https' })).toEqual([])
    })

    test(`should map "/prev/*" => "/next/" using ReplaceKeyWith`, () => {
      const map = { '/agora/*': '/dao/' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { ReplaceKeyWith: "dao/" }
        },
      ]

      const hostRules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { HostName: 'example.com', ReplaceKeyWith: "dao/" }
        },
      ]

      const hostProtocolRules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { HostName: 'example.com', Protocol: 'https', ReplaceKeyWith: "dao/" }
        },
      ]

      expect(createRoutingRules(map)).toEqual(rules)
      expect(createRoutingRules(map, { hostname: 'example.com' })).toEqual(hostRules)
      expect(createRoutingRules(map, { hostname: 'example.com', protocol: 'https' })).toEqual(hostProtocolRules)
    })

    test(`should map "/prev/*" => "/next/$1" using ReplaceKeyPrefixWith`, () => {
      const map = { '/docs/*': '/documentation/$1' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { ReplaceKeyPrefixWith: "documentation/" }
        },
      ]

      const hostRules = [
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { HostName: 'example.com', ReplaceKeyPrefixWith: "documentation/" }
        },
      ]

      const hostProtocolRules = [
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { HostName: 'example.com', Protocol: 'https', ReplaceKeyPrefixWith: "documentation/" }
        },
      ]

      expect(createRoutingRules(map)).toEqual(rules)
      expect(createRoutingRules(map, { hostname: 'example.com' })).toEqual(hostRules)
      expect(createRoutingRules(map, { hostname: 'example.com', protocol: 'https' })).toEqual(hostProtocolRules)
    })

    test(`should map "/prev/*" => "https://example.com/next/" using Protocol, HostName and ReplaceKeyWith`, () => {
      const map = { '/avatars/*': 'https://builder.decentraland.org/names/' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "avatars/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyWith: "names/" }
        },
      ]

      expect(createRoutingRules(map)).toEqual(rules)
    })

    test(`should map "/prev/*" => "https://example.com/next/" using Protocol, HostName and ReplaceKeyPrefixWith`, () => {
      const map = { '/builder/*': 'https://builder.decentraland.org/$1' }

      const rules = [
        {
          Condition: { KeyPrefixEquals: "builder/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyPrefixWith: "" }
        },
      ]

      expect(createRoutingRules(map)).toEqual(rules)
    })

    test(`should accept multiples redirection`, () => {
      const map = {
        '/agora/*': '/dao/',
        '/docs/*': '/documentation/$1',
        '/avatars/*': 'https://builder.decentraland.org/names/',
        '/builder/*': 'https://builder.decentraland.org/$1'
      }

      const rules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { ReplaceKeyWith: "dao/" }
        },
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { ReplaceKeyPrefixWith: "documentation/" }
        },
        {
          Condition: { KeyPrefixEquals: "avatars/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyWith: "names/" }
        },
        {
          Condition: { KeyPrefixEquals: "builder/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyPrefixWith: "" }
        },
      ]

      const hostRules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { HostName: 'example.com', ReplaceKeyWith: "dao/" }
        },
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { HostName: 'example.com', ReplaceKeyPrefixWith: "documentation/" }
        },
        {
          Condition: { KeyPrefixEquals: "avatars/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyWith: "names/" }
        },
        {
          Condition: { KeyPrefixEquals: "builder/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyPrefixWith: "" }
        },
      ]

      const hostProtocolRules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { HostName: 'example.com', Protocol: 'https', ReplaceKeyWith: "dao/" }
        },
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { HostName: 'example.com', Protocol: 'https', ReplaceKeyPrefixWith: "documentation/" }
        },
        {
          Condition: { KeyPrefixEquals: "avatars/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyWith: "names/" }
        },
        {
          Condition: { KeyPrefixEquals: "builder/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyPrefixWith: "" }
        },
      ]

      expect(createRoutingRules(map)).toEqual(rules)
      expect(createRoutingRules(map, { hostname: 'example.com' })).toEqual(hostRules)
      expect(createRoutingRules(map, { hostname: 'example.com', protocol: 'https' })).toEqual(hostProtocolRules)
    })
  })
})