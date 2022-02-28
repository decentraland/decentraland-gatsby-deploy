export function slug (value: string) {
  return value.replace(/\W/g, "-").replace(/^\-+/, '').replace(/\-+$/, '');
}

export function truthy<T>(values: (T | undefined | null | false)[]): T[] {
  return values.filter(Boolean) as T[]
}

export function getServiceVersion() {
  return process.env['CI_COMMIT_TAG'] ||
    (process.env['CI_COMMIT_SHA'] && process.env['CI_COMMIT_SHA'].slice(0, 6)) ||
    process.env['CI_COMMIT_BRANCH'] || 'current'
}

export function getStackId () {
  return process.env.STACK_ID || 'default'
}

export function getServiceName (name: string) {
  return slug(name)
}

export function getServiceNameAndTLD(domain: string) {
  const parts = domain.split('.')
  if (parts.length < 2) {
    throw new Error(`Unexpected domain: "${domain}"`)
  }

  const tld = parts.slice(-2).join('.')
  const serviceName = parts.slice(0, -2).join('.')

  return [serviceName || null, tld] as const
}

export function getScopedServiceName (name: string) {
  const stackId = process.env.STACK_ID
  if (stackId) {
    return `${slug(name)}-${slug(stackId)}`
  }

  return slug(name)
}

export function debug<T extends (object | string | number | null | undefined)>(value: T): T {
  try {
    console.log('debug:', JSON.stringify(value, null, 2));
  } catch (err) {
    console.log('debug:', value);
  }

  return value
}