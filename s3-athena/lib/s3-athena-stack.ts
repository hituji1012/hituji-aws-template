import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as config from '../app-config.json';

export class S3AthenaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { project, bucket: bucketConfig, athena: athenaConfig } = config;

    // S3 Data Lake Bucket (data storage + Athena query results)
    const bucket = new s3.Bucket(this, `${bucketConfig.id}Bucket`, {
      bucketName: `${bucketConfig.bucketName}-${project.stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: bucketConfig.versioned,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          // Athena クエリ結果は 30 日で自動削除
          prefix: athenaConfig.resultsPrefix,
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    // Glue Database (Athena のテーブル定義を管理)
    const glueDatabase = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: athenaConfig.databaseName,
        description: `${project.description} - Glue catalog database`,
      },
    });

    // Athena Workgroup
    const workgroup = new athena.CfnWorkGroup(this, 'AthenaWorkGroup', {
      name: `${athenaConfig.workgroupName}-${project.stage}`,
      description: `${project.description} - Athena workgroup`,
      state: 'ENABLED',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${bucket.bucketName}/${athenaConfig.resultsPrefix}`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_S3',
          },
        },
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        bytesScannedCutoffPerQuery: 1_073_741_824, // 1 GB スキャン上限
      },
    });
    workgroup.addDependency(glueDatabase);

    // IAM Role for Athena query execution
    const athenaRole = new iam.Role(this, 'AthenaExecutionRole', {
      roleName: `${athenaConfig.workgroupName}-role-${project.stage}`,
      assumedBy: new iam.ServicePrincipal('athena.amazonaws.com'),
      description: 'Role for Athena to access S3 data lake and Glue catalog',
    });

    bucket.grantReadWrite(athenaRole);

    athenaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'glue:GetDatabase',
          'glue:GetDatabases',
          'glue:GetTable',
          'glue:GetTables',
          'glue:GetPartition',
          'glue:GetPartitions',
          'glue:CreateTable',
          'glue:UpdateTable',
          'glue:DeleteTable',
          'glue:BatchCreatePartition',
          'glue:BatchDeletePartition',
        ],
        resources: [
          `arn:aws:glue:${this.region}:${this.account}:catalog`,
          `arn:aws:glue:${this.region}:${this.account}:database/${athenaConfig.databaseName}`,
          `arn:aws:glue:${this.region}:${this.account}:table/${athenaConfig.databaseName}/*`,
        ],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 Data Lake bucket name',
    });

    new cdk.CfnOutput(this, 'BucketDataPrefix', {
      value: `s3://${bucket.bucketName}/${athenaConfig.dataPrefix}`,
      description: 'S3 path for storing data (use this as LOCATION in CREATE TABLE)',
    });

    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: athenaConfig.databaseName,
      description: 'Glue database name for Athena',
    });

    new cdk.CfnOutput(this, 'AthenaWorkgroupName', {
      value: workgroup.name,
      description: 'Athena workgroup name',
    });

    new cdk.CfnOutput(this, 'AthenaResultsLocation', {
      value: `s3://${bucket.bucketName}/${athenaConfig.resultsPrefix}`,
      description: 'S3 path for Athena query results',
    });

    new cdk.CfnOutput(this, 'AthenaExecutionRoleArn', {
      value: athenaRole.roleArn,
      description: 'IAM Role ARN for Athena execution',
    });
  }
}
