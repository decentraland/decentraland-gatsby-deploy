#!/usr/bin/env bash
export PATH="$PATH:$HOME/.pulumi/bin"

PULUMI_PATH="$1"
if [ "$PULUMI_PATH" = "" ]; then
  PULUMI_PATH=$PWD
fi

SCRIPT="bin/setup-environment.js"
OUTPUT="$PULUMI_PATH/setup-environment.$RANDOM.sh"

if [ -f "node_modules/decentraland-gatsby-deploy/bin/setup-environment.js" ]; then
  SCRIPT="node_modules/decentraland-gatsby-deploy/bin/setup-environment.js"
fi

node "$SCRIPT" "$PULUMI_PATH" "$OUTPUT" $2

if [ -f "$OUTPUT" ]; then
  chmod +x $OUTPUT
  source "$OUTPUT"
  # rm $OUTPUT
fi
