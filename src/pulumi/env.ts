import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import { allConfig } from "@pulumi/pulumi/runtime/config";

const config = new pulumi.Config();

/**
 * Create a `awsx.ecs.KeyValuePair` usgin name and value params,
 * if value param is missing it will use the stack config
 * if there isn't any stack config with that name it will use the environment variable
 * if there isn't any environment variable with that name it will use an empty string
 */
export function variable(
  name: string,
  value: pulumi.Input<string> = config.get(name) ?? process.env[name] ?? ''
): awsx.ecs.KeyValuePair {
  return { name, value }
}

/**
 * Read a secret from the stack and returns a
 * `awsx.ecs.KeyValuePair` with it
 *
 * @param name the secret name
 */
export function secret(name: string) {
  return variable(name, config.requireSecret(name))
}

/**
 * List all configuration in the stack and
 * returns is as a list of `awsx.ecs.KeyValuePair`
 *
 * @example: for the following stack configuration
 *
 * ```yaml
 *  encryptionsalt: ...
 *  config:
 *    aws:region: us-east-1
 *    stack:PUBLIC_ENV: "this is a public configuration"
 *    stack:PRIVATE_ENV:
 *      secure: ...
 * ```
 *
 * ```typescript
 *  currentStackConfigurations()
 *    //  [
 *    //    { name: 'AWS_REGION', value: pulumi.Output('us-east-1') }
 *    //    { name: 'PUBLIC_ENV', value: pulumi.Output('this is a public configuration') }
 *    //    { name: 'PRIVATE_ENV', value: pulumi.Output('this is a secret decrypted') }
 *    //  ]
 * ```
 *
 */
export function currentStackConfigurations() {
  const settings = allConfig()
  return Object.keys(settings)
    .map((key) => {
      if (key.startsWith('aws:') && settings[key] !== '[secret]') {
        const name = key.replace(/\W+/gi, '_').toUpperCase()
        const value = settings[key]
        return { name, value }

      } else if (key.startsWith(config.name + ':') ) {
        const name = key.slice(config.name.length + 1)
        const value = settings[key] === '[secret]' ? config.requireSecret(name) : settings[key]
        return { name, value }

      } else {
        return null!
      }
    })
    .filter(Boolean)
}
