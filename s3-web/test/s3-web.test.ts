import * as cdk from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { S3WebStack } from '../lib/s3-web-stack';

test('S3 buckets created for each config entry', () => {
  const app = new cdk.App();
  const stack = new S3WebStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  // app-config.json has 2 bucket entries
  template.resourceCountIs('AWS::S3::Bucket', 2);
});

test('CloudFront distributions created for each bucket with cloudfront.enabled=true', () => {
  const app = new cdk.App();
  const stack = new S3WebStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::CloudFront::Distribution', 2);
});

test('S3 buckets block all public access', () => {
  const app = new cdk.App();
  const stack = new S3WebStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.allResourcesProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('CloudFront distributions enforce HTTPS', () => {
  const app = new cdk.App();
  const stack = new S3WebStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.allResourcesProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: {
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: 'redirect-to-https',
      },
    },
  });
});
