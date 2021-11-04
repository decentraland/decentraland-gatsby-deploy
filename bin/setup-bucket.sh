! /bin/bash

source dcl-env

export PATH=$PATH:$HOME/.pulumi/bin

if [ ! $1 ]; then
  echo '❌  You must provide a folder name ending with `/` to upload to the bucket'
  exit 2;
fi

origin=$1/
shift

target=s3://$(pulumi stack output bucketName)/

if [ ! $target ]; then
  echo '❌ pulumi output "bucketName" not found'
  exit 2;
fi

set -o noglob
aws s3 cp \
  --recursive \
  --acl public-read \
  $origin $target \
  $@
set +o noglob