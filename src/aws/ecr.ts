import { resolve } from 'path'
import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import { getImageRegistryAndCredentials } from "dcl-ops-lib/getImageRegistryAndCredentials";

export function createDockerImage(serviceName: string, serviceSourcePath: string = '.') {
  const context = resolve(process.cwd(), serviceSourcePath)
  const ecr = new aws.ecr.Repository(serviceName)
  const registry = getImageRegistryAndCredentials(ecr)
  const image = new docker.Image(`${serviceName}-image`, {
    imageName: ecr.repositoryUrl.apply(name => {
      if (process.env.CI_COMMIT_TAG) {
        return `${name}:${process.env.CI_COMMIT_TAG}`
      } else if (process.env.CI_COMMIT_SHA) {
        return `${name}:${process.env.CI_COMMIT_SHA}`
      } else {
        return name
      }
    }),
    registry: registry,
    build: {
        context,
        cacheFrom: true,
        env: { 'DOCKER_BUILDKIT': '1', }
    }
  });

  return image.imageName
}
