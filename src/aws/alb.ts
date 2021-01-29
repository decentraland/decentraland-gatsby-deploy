import * as aws from "@pulumi/aws";

export type HostForwardOptions = {
  hosts: string[],
  targetGroup: aws.lb.TargetGroup
}

/**
 * create a `aws.alb.ListenerRule` attached to Listener that forwards
 * request from a list of host to a `aws.lb.TargetGroup`
 */
export function createHostForwardListenerRule(name: string, listener: aws.lb.GetListenerResult, options: HostForwardOptions) {
  return new aws.alb.ListenerRule(name, {
    listenerArn: listener.arn,
    conditions: [
      {
        hostHeader: {
          values: options.hosts
        }
      }
    ],
    actions: [
      {
        type: "forward",
        targetGroupArn: options.targetGroup.arn,
      },
    ],
  })
}