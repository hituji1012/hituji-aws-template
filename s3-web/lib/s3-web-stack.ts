import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as config from '../app-config.json';

export class S3WebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const { project, buckets } = config;

    for (const bucketConfig of buckets) {
      // S3 Bucket
      const bucket = new s3.Bucket(this, `${bucketConfig.id}Bucket`, {
        bucketName: `${bucketConfig.bucketName}-${project.stage}`,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        autoDeleteObjects: false,
        versioned: false,
      });

      if (bucketConfig.cloudfront.enabled) {
        // CloudFront OAC + Distribution
        const distribution = new cloudfront.Distribution(this, `${bucketConfig.id}Distribution`, {
          defaultBehavior: {
            origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: new cloudfront.CachePolicy(this, `${bucketConfig.id}CachePolicy`, {
              defaultTtl: cdk.Duration.seconds(bucketConfig.cloudfront.defaultTtlSeconds),
              maxTtl: cdk.Duration.seconds(bucketConfig.cloudfront.maxTtlSeconds),
            }),
          },
          defaultRootObject: bucketConfig.indexDocument,
          errorResponses: [
            {
              httpStatus: 403,
              responseHttpStatus: 200,
              responsePagePath: `/${bucketConfig.errorDocument}`,
            },
            {
              httpStatus: 404,
              responseHttpStatus: 200,
              responsePagePath: `/${bucketConfig.errorDocument}`,
            },
          ],
          priceClass: cloudfront.PriceClass[bucketConfig.cloudfront.priceClass as keyof typeof cloudfront.PriceClass],
        });

        new cdk.CfnOutput(this, `${bucketConfig.id}DistributionUrl`, {
          value: `https://${distribution.distributionDomainName}`,
          description: `${project.description} - ${bucketConfig.id} CloudFront URL`,
        });

        new cdk.CfnOutput(this, `${bucketConfig.id}DistributionId`, {
          value: distribution.distributionId,
          description: `${project.description} - ${bucketConfig.id} CloudFront Distribution ID`,
        });
      }

      new cdk.CfnOutput(this, `${bucketConfig.id}BucketName`, {
        value: bucket.bucketName,
        description: `${project.description} - ${bucketConfig.id} S3 Bucket Name`,
      });
    }
  }
}
