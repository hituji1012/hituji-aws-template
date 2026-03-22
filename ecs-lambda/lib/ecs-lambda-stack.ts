import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as config from '../app-config.json';

export class EcsLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { project, stack } = config;

    // S3
    const bucket = new s3.Bucket(this, 'DataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM - Lambda Execution Role
    const executionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
      })
    );

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/lambda/${project.name}-${project.stage}-${stack.lambda.functionName}`,
      retention: stack.logs.retentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Docker Image Asset
    const imageAsset = new ecr_assets.DockerImageAsset(this, 'LambdaImage', {
      directory: './lambda',
      platform: ecr_assets.Platform.LINUX_ARM64,
    });

    // Lambda Function
    const lambdaFn = new lambda.DockerImageFunction(this, 'LambdaFunction', {
      functionName: `${project.name}-${project.stage}-${stack.lambda.functionName}`,
      code: lambda.DockerImageCode.fromEcr(imageAsset.repository, {
        tagOrDigest: imageAsset.imageTag,
      }),
      architecture: lambda.Architecture.ARM_64,
      memorySize: stack.lambda.memorySize,
      timeout: cdk.Duration.seconds(stack.lambda.timeoutSeconds),
      role: executionRole,
      logGroup,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        LOG_LEVEL: stack.lambda.environment.LOG_LEVEL,
      },
    });

    // EventBridge Rule
    const rule = new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.expression(stack.eventBridge.scheduleExpression),
      enabled: stack.eventBridge.enabled,
    });

    rule.addTarget(new targets.LambdaFunction(lambdaFn));

    // Outputs
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: lambdaFn.functionName,
      description: `${project.description} - Lambda Function Name`,
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: bucket.bucketName,
      description: `${project.description} - S3 Bucket Name`,
    });
  }
}
