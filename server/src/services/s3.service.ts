import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

import { env } from "../config/env.js";

const s3Client = new S3Client({
  region: env.awsRegion,
  credentials: {
    accessKeyId: env.awsAccessKey,
    secretAccessKey: env.awsSecretKey,
  },
});

export interface UploadParams {
  buffer: Buffer;
  key?: string;
  contentType: string;
}

export async function uploadBufferToS3({ buffer, key, contentType }: UploadParams) {
  const objectKey = key ?? randomUUID();
  const command = new PutObjectCommand({
    Bucket: env.awsBucketName,
    Key: objectKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return `https://${env.awsBucketName}.s3.${env.awsRegion}.amazonaws.com/${objectKey}`;
}
