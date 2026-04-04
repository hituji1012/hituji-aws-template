import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { S3AthenaStack } from '../lib/s3-athena-stack';

describe('S3AthenaStack', () => {
  const app = new cdk.App();
  const stack = new S3AthenaStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  test('S3 bucket is created with correct settings', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'hituji-datalake-dev',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('Glue database is created', () => {
    template.hasResourceProperties('AWS::Glue::Database', {
      DatabaseInput: {
        Name: 'hituji_analytics_db',
      },
    });
  });

  test('Athena workgroup is created', () => {
    template.hasResourceProperties('AWS::Athena::WorkGroup', {
      Name: 'hituji-analytics-dev',
      State: 'ENABLED',
    });
  });

  test('IAM role for Athena is created', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'hituji-analytics-role-dev',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'athena.amazonaws.com' },
          },
        ],
      },
    });
  });
});
