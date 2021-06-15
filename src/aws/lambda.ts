import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import withCache from "dcl-ops-lib/withCache";
import { resolve } from "path";

export const getStaticResponseViewer = withCache(function createStaticResponseViewer() {
  const role = new aws.iam.Role(`static-response-viewer-role`, {
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: "",
          Effect: "Allow",
          Action: "sts:AssumeRole",
          Principal: {
            Service: [
              "lambda.amazonaws.com",
              "edgelambda.amazonaws.com"
            ]
          }
        }
      ]
    }
  })

  const lambda = new aws.lambda.Function(`static-response-viewer`, {
    role: role.arn,
    handler: 'exports.handler',
    runtime: 'nodejs12.x',
    publish: true,
    code: new pulumi.asset.AssetArchive({
      ".": new pulumi.asset.FileArchive(resolve(__dirname, '../../lambda/response-viewer')),
   }),
  })

  return lambda
})