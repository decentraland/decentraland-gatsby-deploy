import * as aws from '@pulumi/aws'
import { getVpc } from "dcl-ops-lib/vpc";

export async function createMetricsSecurityGroup(serviceName: string, ports: number | number[]): Promise<aws.ec2.SecurityGroup> {
  const vpc = await getVpc()
  const ingress = Array.isArray(ports) ? ports : [ ports ]
  return new aws.ec2.SecurityGroup(
    `${serviceName}-metrics-sg`,
    {
      vpcId: vpc.id,
      ingress: Array.from(new Set(ingress), (port) => ({
        protocol: 'tcp',
        fromPort: port,
        toPort: port,
        cidrBlocks: [ vpc.vpc.cidrBlock ]
      }))
    }
  )
}

export async function createMetricsSecurityGroupId(serviceName: string, ports: number | number[]) {
  const sg = await createMetricsSecurityGroup(serviceName, ports)
  return sg.id
}