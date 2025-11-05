import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
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

export function parseS3KeyFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Virtual-hosted style: <bucket>.s3.<region>.amazonaws.com/<key>
    // Path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    const host = parsed.host;
    const path = parsed.pathname.replace(/^\//, "");
    if (!path) return null;
    if (host.startsWith("s3.") || host.startsWith("s3-")) {
      // path-style, first segment is bucket
      const firstSlash = path.indexOf("/");
      if (firstSlash === -1) return null;
      return path.substring(firstSlash + 1);
    }
    // otherwise virtual-hosted, entire path is key
    return path;
  } catch {
    return null;
  }
}

export async function deleteObjectByKey(key: string) {
  if (!key) return;
  const cmd = new DeleteObjectCommand({ Bucket: env.awsBucketName, Key: key });
  await s3Client.send(cmd);
}

export async function deleteAllWithPrefix(prefix: string): Promise<number> {
  if (!prefix) return 0;
  let continuationToken: string | undefined = undefined;
  let totalDeleted = 0;

  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: env.awsBucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const list = (await s3Client.send(listCmd)) as ListObjectsV2CommandOutput;

    const keys = (list.Contents ?? [])
      .map((o: { Key?: string }) => o.Key)
      .filter((k: string | undefined): k is string => Boolean(k));
    if (keys.length) {
      const delCmd = new DeleteObjectsCommand({
        Bucket: env.awsBucketName,
        Delete: { Objects: keys.map((k: string) => ({ Key: k })) },
      });
      await s3Client.send(delCmd);
      totalDeleted += keys.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalDeleted;
}
