import AWS from 'aws-sdk';
import { config } from '@/config';
import { logger } from '@/utils/logger';

interface UploadResult {
  key: string;
  url: string;
  etag: string;
}

interface PresignedUrlResult {
  url: string;
  key: string;
  expires: number;
}

class S3Client {
  private client: AWS.S3;

  constructor() {
    this.client = new AWS.S3({
      endpoint: `http://${config.s3.endpoint}:${config.s3.port}`,
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
      region: config.s3.region,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      sslEnabled: config.s3.useSSL,
    });
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const result = await this.client
        .upload({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          Metadata: metadata || {},
        })
        .promise();

      logger.info('File uploaded to S3', { bucket, key, etag: result.ETag });

      return {
        key: result.Key,
        url: result.Location,
        etag: result.ETag || '',
      };
    } catch (error) {
      logger.error('Error uploading file to S3', { bucket, key, error });
      throw error;
    }
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    try {
      const result = await this.client
        .getObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      if (!result.Body) {
        throw new Error('File body is empty');
      }

      return result.Body as Buffer;
    } catch (error) {
      logger.error('Error downloading file from S3', { bucket, key, error });
      throw error;
    }
  }

  async delete(bucket: string, key: string): Promise<void> {
    try {
      await this.client
        .deleteObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      logger.info('File deleted from S3', { bucket, key });
    } catch (error) {
      logger.error('Error deleting file from S3', { bucket, key, error });
      throw error;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client
        .headObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();

      return true;
    } catch (error: any) {
      if (error.code === 'NotFound' || error.statusCode === 404) {
        return false;
      }
      logger.error('Error checking file existence in S3', { bucket, key, error });
      throw error;
    }
  }

  async getPresignedUrlForUpload(
    bucket: string,
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    try {
      const url = await this.client.getSignedUrlPromise('putObject', {
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn,
      });

      return {
        url,
        key,
        expires: expiresIn,
      };
    } catch (error) {
      logger.error('Error generating presigned URL for upload', { bucket, key, error });
      throw error;
    }
  }

  async getPresignedUrlForDownload(
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    try {
      const url = await this.client.getSignedUrlPromise('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expiresIn,
      });

      return {
        url,
        key,
        expires: expiresIn,
      };
    } catch (error) {
      logger.error('Error generating presigned URL for download', { bucket, key, error });
      throw error;
    }
  }

  async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destinationBucket: string,
    destinationKey: string
  ): Promise<void> {
    try {
      await this.client
        .copyObject({
          Bucket: destinationBucket,
          Key: destinationKey,
          CopySource: `${sourceBucket}/${sourceKey}`,
        })
        .promise();

      logger.info('Object copied in S3', {
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
      });
    } catch (error) {
      logger.error('Error copying object in S3', {
        sourceBucket,
        sourceKey,
        destinationBucket,
        destinationKey,
        error,
      });
      throw error;
    }
  }

  async listObjects(bucket: string, prefix?: string): Promise<AWS.S3.ObjectList> {
    try {
      const result = await this.client
        .listObjectsV2({
          Bucket: bucket,
          Prefix: prefix,
        })
        .promise();

      return result.Contents || [];
    } catch (error) {
      logger.error('Error listing objects in S3', { bucket, prefix, error });
      throw error;
    }
  }

  async getBucketLocation(bucket: string): Promise<string> {
    try {
      const result = await this.client.getBucketLocation({ Bucket: bucket }).promise();
      return result.LocationConstraint || config.s3.region;
    } catch (error) {
      logger.error('Error getting bucket location', { bucket, error });
      throw error;
    }
  }

  async createBucket(bucket: string): Promise<void> {
    try {
      await this.client.createBucket({ Bucket: bucket }).promise();
      logger.info('Bucket created', { bucket });
    } catch (error: any) {
      if (error.code !== 'BucketAlreadyExists' && error.code !== 'BucketAlreadyOwnedByYou') {
        logger.error('Error creating bucket', { bucket, error });
        throw error;
      }
    }
  }

  // Convenience methods for specific buckets
  async uploadScreenshot(key: string, body: Buffer | string): Promise<UploadResult> {
    return this.upload(config.s3.bucket, key, body, 'image/png');
  }

  async uploadBaseline(key: string, body: Buffer | string): Promise<UploadResult> {
    return this.upload(config.s3.baselineBucket, key, body, 'image/png');
  }

  async uploadDiff(key: string, body: Buffer | string): Promise<UploadResult> {
    return this.upload(config.s3.diffBucket, key, body, 'image/png');
  }

  async uploadTrace(key: string, body: Buffer | string): Promise<UploadResult> {
    return this.upload(config.s3.traceBucket, key, body, 'application/zip');
  }

  async downloadScreenshot(key: string): Promise<Buffer> {
    return this.download(config.s3.bucket, key);
  }

  async downloadBaseline(key: string): Promise<Buffer> {
    return this.download(config.s3.baselineBucket, key);
  }

  async downloadDiff(key: string): Promise<Buffer> {
    return this.download(config.s3.diffBucket, key);
  }

  async downloadTrace(key: string): Promise<Buffer> {
    return this.download(config.s3.traceBucket, key);
  }
}

export const s3Client = new S3Client();