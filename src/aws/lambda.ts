import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { resolve } from "path";

export type CreateLambdaOptions = {
  logGroup: aws.cloudwatch.LogGroup | null | undefined,
  tags: pulumi.Input<aws.Tags> | undefined
}

export function createSecurityHeadersLambda(name: string, options: Partial<CreateLambdaOptions> = {}) {
  const role = new aws.iam.Role(`${name}-lambda-edge-role`, {
    path: '/lambda@edge/',
    managedPolicyArns: [
      aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole
    ],
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: "AllowLambdaServiceToAssumeRole",
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

  if (options.logGroup) {
    const lambdaLogginPolicy = new aws.iam.Policy(`${name}-lambda-edge-loggin-policy`, {
      description: 'IAM policy for logging from a lambda@edge',
      policy: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Action": [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents"
            ],
            "Resource": options.logGroup.arn, // "arn:aws:logs:*:*:*",
            "Effect": "Allow"
          }
        ]
      }
    })

    new aws.iam.RolePolicyAttachment(`${name}-lambda-edge-logs`, {
      role: role.name,
      policyArn: lambdaLogginPolicy.arn
    })
  }

  const lambda = new aws.lambda.Function(`${name}-security-headers-lambda`,
    {
      role: role.arn,
      handler: 'index.handler',
      runtime: 'nodejs12.x',
      description: 'Adds security headers to the response',
      publish: true,
      tags: options.tags || {},
      code: new pulumi.asset.AssetArchive({
          ".": new pulumi.asset.FileArchive(resolve(__dirname, '../../lambda/response-viewer')),
      }),
    })

  return lambda
}