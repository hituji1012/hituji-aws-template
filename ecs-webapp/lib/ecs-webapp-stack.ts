import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as config from '../app-config.json';

export class EcsWebappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { project, stack } = config;

    // VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: stack.vpc.maxAzs,
      natGateways: stack.vpc.natGateways,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // IAM - Task Execution Role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${project.name}-${project.stage}`,
      retention: stack.logs.retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `${project.name}-${project.stage}-${stack.ecs.clusterName}`,
    });

    // Docker Image Asset
    const imageAsset = new ecr_assets.DockerImageAsset(this, 'AppImage', {
      directory: './app',
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      cpu: stack.ecs.cpu,
      memoryLimitMiB: stack.ecs.memoryLimitMiB,
      executionRole,
    });

    taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(imageAsset),
      portMappings: [{ containerPort: stack.ecs.containerPort }],
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'ecs',
      }),
    });

    // Security Groups
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(stack.alb.port));

    const ecsSg = new ec2.SecurityGroup(this, 'EcsSg', {
      vpc,
    });
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(stack.ecs.containerPort));

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const listener = alb.addListener('Listener', {
      port: stack.alb.port,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    // ECS Fargate Service
    const fargateService = new ecs.FargateService(this, 'FargateService', {
      cluster,
      taskDefinition,
      desiredCount: stack.ecs.desiredCount,
      securityGroups: [ecsSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    listener.addTargets('EcsTarget', {
      port: stack.alb.port,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [fargateService],
      healthCheck: {
        path: '/',
      },
    });

    // Output
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: `${project.description} - ALB DNS Name`,
    });
  }
}
