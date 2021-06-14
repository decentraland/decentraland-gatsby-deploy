import * as aws from "@pulumi/aws";
import withCache from "dcl-ops-lib/withCache";

export type Headers = Record<string, string | string[]>

export type ResponseHttpEvent = {
  "headers": Record<string,{ key: string, value: string }[]>,
  "status": string,
  "statusDescription": string,
}

export type ResponseViewerEvent = {
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": string,
          "distributionId": string,
          "eventType": string,
          "requestId": string,
        },
        "request": {
          "clientIp": string,
          "headers": Record<string,{ key: string, value: string }[]>,
          "method": string,
          "querystring": string,
          "uri": string,
        },
        "response": ResponseHttpEvent
      }
    }
  ]
}

export const getStaticResponseViewer = withCache(function createStaticResponseViewer() {
  const lambda = new aws.lambda.CallbackFunction(`static-response-viewer`, {
    callback: (event: ResponseViewerEvent, _context: any, callback: (err: Error | null, response?: ResponseHttpEvent) => void) => {
      // Get contents of response
      const data = event.Records[0].cf
      const request = data.request;
      const response = data.response;

      const host = (request.headers['host'] || [ { key: 'Host', value: null } ])[0].value
      const uri = request.uri || ''
      const tld = host.split('.').slice(-2).join('.')
      const scriptPolicies = Array.from(new Set([
        '"self"',
        `https://${tld}`,
        `https://*.${tld}`,
        'https://decentraland.org',
        'https://*.decentraland.org',
        // 'https://ajax.cloudflare.com', deprecated
        'https://www.google-analytics.com',
        // 'https://www.googletagmanager.com', disabled
        'https://cdn.rollbar.com',
        // 'https://a.klaviyo.com', deprecated
        // 'https://widget.intercom.io', disabled
        // 'https://js.intercomcdn.com', disabled
        // 'https://connect.facebook.net', deprecated
      ])).join(' ')

      function setHeader(key: string, value: string) {
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
      setHeader(
        'Content-Security-Policy',
        [
          `default-src "self"`,
          `script-src ${scriptPolicies}`,
          `font-src https: data:`,
          `style-src https: data:`,
          `img-src https: data:`,
          `connect-src https:`,
          `frame-src https:`,
          `child-src https:`,
          `object-src 'none'`,
          `frame-ancestors 'none'`
        ].join('; ')
      )

      if (uri.endsWith('.json') || uri.endsWith('.xml')) {
        setHeader('Access-Control-Allow-Origin', '*')
        setHeader('Access-Control-Allow-Headers', 'Content-Type')
        setHeader('Access-Control-Allow-Methods', 'OPTIONS,HEAD,GET')
      }

      // try {
      //   const headers: Headers = JSON.parse(process.env.RESPONSE_VIEWER_EXTRA_HEADERS || '{}')
      //   for (const key of Object.keys(headers)) {
      //     const header = headers[key]
      //     const values: string[] = Array.isArray(header) ? header : [ header ]
      //     response.headers[key.toLowerCase()] = values.map(value => ({ key, value }))
      //   }
      // } catch (err) {
      //   console.error(err, data)
      // }
      callback(null, response)
    },
    // environment: {
    //   variables: {
    //     RESPONSE_VIEWER_EXTRA_HEADERS: JSON.stringify(headers)
    //   }
    // }
  })

  return lambda
})