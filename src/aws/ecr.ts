import { resolve } from 'path'
import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import { getImageRegistryAndCredentials } from "dcl-ops-lib/getImageRegistryAndCredentials";

export function createDockerImage(serviceName: string, serviceSourcePath: string = '.') {
  const context = resolve(process.cwd(), serviceSourcePath)
  const ecr = new aws.ecr.Repository(serviceName)
  const registry = getImageRegistryAndCredentials(ecr)
  new docker.Image(`${serviceName}-image`, {
    imageName: ecr.repositoryUrl,
    registry: registry,
    build: {
        context,
        cacheFrom: true,
        env: { 'DOCKER_BUILDKIT': '1', }
    }
  });

  return ecr.repositoryUrl
}
