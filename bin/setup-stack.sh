#!/usr/bin/env bash

export PATH="$PATH:$HOME/.pulumi/bin"
source dcl-env

# setup project environment
pulumi login -c "s3://$STATE_BUCKET/"

if pulumi stack select "$PULUMI_STACK-$ENVIRONMENT"; then
  echo "[stack $stack] Stack exists ✅";
else
  pulumi stack init "$PULUMI_STACK-$ENVIRONMENT"
  echo "[stack $stack] Stack created ✅";
fi