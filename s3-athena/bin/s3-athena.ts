#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { S3AthenaStack } from '../lib/s3-athena-stack';

const app = new cdk.App();
new S3AthenaStack(app, 'S3AthenaStack', {
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
