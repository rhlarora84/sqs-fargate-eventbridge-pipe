import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Queue} from "aws-cdk-lib/aws-sqs";
import {Cluster, ContainerImage, FargateTaskDefinition, LogDriver} from "aws-cdk-lib/aws-ecs";
import {CfnPipe} from "aws-cdk-lib/aws-pipes";
import {SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {Effect, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {JsonPath} from "aws-cdk-lib/aws-stepfunctions";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {CfnOutput} from "aws-cdk-lib";

export class AppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Dead letter Queue for exception handling or failures
        const deadLetterQueue = new Queue(this, 'deadLetterQueue', {
            queueName: 'sqs-event-queue-dlq',
        });

        // SQS Queue
        const queue = new Queue(this, 'sqsQueue', {
            queueName: 'sqs-event-queue',
            deadLetterQueue: {
                queue: deadLetterQueue,
                maxReceiveCount: 2
            }
        });

        // VPC to create ECS Cluster and invoke Task
        const vpc = Vpc.fromLookup(this, 'vpc', {
            isDefault: true
        });

        // Cluster to Invoke task
        const ecsCluster = new Cluster(this, 'ecsCluster', {
            clusterName: 'ecs-cluster',
            enableFargateCapacityProviders: true,
            vpc: vpc
        });

        // Task Definition
        const fargateTaskDefinition = new FargateTaskDefinition(this, 'fargateTaskDefinition', {
            memoryLimitMiB: 512,
            cpu: 256,
        });

        fargateTaskDefinition.addContainer('defaultContainer', {
            image: ContainerImage.fromRegistry('alpine'),
            logging: LogDriver.awsLogs({
                streamPrefix: '/app/',
                logRetention: RetentionDays.ONE_DAY
            })
        });

        // Create the necessary IAM Role for Pipe
        const pipeRole = new Role(this, 'eventbridgeIAMRole', {
            roleName: 'sqs-fargate-pipe-role',
            description: 'IAM Role for EventBridge Pipe',
            assumedBy: new ServicePrincipal('pipes.amazonaws.com')
        });
        //Consume Permission on SQS
        queue.grantConsumeMessages(pipeRole);
        // RunTask Permission on Cluster
        pipeRole.addToPolicy(new PolicyStatement({
            actions: ['ecs:RunTask'],
            resources: [fargateTaskDefinition.taskDefinitionArn],
            effect: Effect.ALLOW,
            conditions: {
                'ArnLike': {
                    'ecs:cluster': ecsCluster.clusterArn
                }
            }
        }))
        pipeRole.addToPolicy(new PolicyStatement({
            actions: ['iam:PassRole'],
            resources: ['*'],
            effect: Effect.ALLOW,
            conditions: {
                'StringLike': {
                    'iam:PassedToService': 'ecs-tasks.amazonaws.com'
                }
            }
        }))

        // EventBridge Pipe with source as SQS and Target as Fargate Task
        // Payload from SQS passed as Environment Variables to Fargate Task
        const cfnPipe = new CfnPipe(this, 'eventbridgePipe', {
            name: `sqs-fargate-task-pipe`,
            description: 'Eventbridge Pipe to invoke Fargate Task',
            roleArn: pipeRole.roleArn,
            source: queue.queueArn,
            target: ecsCluster.clusterArn,
            sourceParameters: {
                sqsQueueParameters: {
                    batchSize: 1,
                    maximumBatchingWindowInSeconds: 120
                },
            },
            targetParameters: {
                ecsTaskParameters: {
                    capacityProviderStrategy: [{
                        capacityProvider: 'FARGATE_SPOT', // Use CapacityProvider or LaunchType
                        base: 1
                    }],
                    taskDefinitionArn: fargateTaskDefinition.taskDefinitionArn,
                    taskCount: 1,
                    networkConfiguration: {
                        // Specify the Subnets and other network settings to be used for Task
                        // depending on your VPC configuration
                        awsvpcConfiguration: {
                            subnets: vpc.selectSubnets({
                                subnetType: SubnetType.PUBLIC
                            }).subnets.map(subnet => subnet.subnetId),
                            assignPublicIp: 'ENABLED'
                        },
                    },
                    overrides: {
                        containerOverrides: [
                            {
                                name: fargateTaskDefinition.defaultContainer?.containerName,
                                command: ['/bin/echo', JsonPath.stringAt('$.body.SQS_PAYLOAD')],
                            },
                        ],
                        // this should not be required but CDK validation fails without it
                        ephemeralStorage: {
                            sizeInGiB: 21
                        },
                    }
                }
            },
        });

        new CfnOutput(this, 'sqsQueueOutput', {
            description: 'SQS Queue Url',
            value: queue.queueUrl
        })

        new CfnOutput(this, 'eventbridgePipeOutput', {
            description: 'EventBridge Pipe',
            value: cfnPipe.name!
        })

    }

}
