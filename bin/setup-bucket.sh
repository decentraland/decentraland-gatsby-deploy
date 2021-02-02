#! /bin/bash

source dcl-env

export PATH=$PATH:$HOME/.pulumi/bin

if [ ! $1 ]; then
  echo '❌  You must provide a folder name ending with `/` to upload to the bucket'
  exit 2;
fi

target=s3://$(pulumi stack output bucketName)/

if [ ! $target ]; then
  echo '❌ pulumi output "bucketName" not found'
  exit 2;
fi

aws s3 sync --acl public-read $1/ $target
