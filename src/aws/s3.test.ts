import { routingRules } from './s3'

describe(`src/aws/s3`, () => {
  describe(`routingRules`, () => {

    test(`should accept an empty map`, () => {
      expect(routingRules()).toEqual([])
      expect(routingRules({})).toEqual([])
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
      expect(routingRules(map)).toEqual([])
    })

    test(`should map "/prev/*" => "/next/" using ReplaceKeyWith`, () => {
      const map = { '/agora/*': '/dao/' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "agora/" },
          Redirect: { ReplaceKeyWith: "dao/" }
        },
      ]

      expect(routingRules(map)).toEqual(rules)
    })

    test(`should map "/prev/*" => "/next/$1" using ReplaceKeyPrefixWith`, () => {
      const map = { '/docs/*': '/documentation/$1' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "docs/" },
          Redirect: { ReplaceKeyPrefixWith: "documentation/" }
        },
      ]

      expect(routingRules(map)).toEqual(rules)
    })

    test(`should map "/prev/*" => "https://example.com/next/" using Protocol, HostName and ReplaceKeyWith`, () => {
      const map = { '/avatars/*': 'https://builder.decentraland.org/names/' }
      const rules = [
        {
          Condition: { KeyPrefixEquals: "avatars/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyWith: "names/" }
        },
      ]

      expect(routingRules(map)).toEqual(rules)
    })

    test(`should map "/prev/*" => "https://example.com/next/" using Protocol, HostName and ReplaceKeyPrefixWith`, () => {
      const map = { '/builder/*': 'https://builder.decentraland.org/$1' }

      const rules = [
        {
          Condition: { KeyPrefixEquals: "builder/" },
          Redirect: { Protocol: "https", HostName: "builder.decentraland.org", ReplaceKeyPrefixWith: "" }
        },
      ]

      expect(routingRules(map)).toEqual(rules)
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

      expect(routingRules(map)).toEqual(rules)
    })
  })
})