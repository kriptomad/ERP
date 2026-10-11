import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET || 'filitech-assets';

export async function uploadTenantAsset(params: {
  tenantId: string;
  category: 'avatar' | 'os-photo' | 'fiscal-xml' | 'client-signature' | 'nfe-entry-xml' | 'personal-attachment' | 'general';
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const extension = params.fileName.split('.').pop() || 'bin';
  const uniqueName = `${crypto.randomUUID()}.${extension}`;
  const key = `tenants/${params.tenantId}/${params.category}/${uniqueName}`;

  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: params.body,
    ContentType: params.contentType,
  }));

  return key;
}

export async function getSignedAssetUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSeconds });
}

export async function deleteAsset(key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function uploadMultipleAssets(params: {
  tenantId: string;
  category: string;
  files: Array<{ fileName: string; body: Buffer; contentType: string }>;
}): Promise<string[]> {
  const keys: string[] = [];
  for (const file of params.files) {
    const key = await uploadTenantAsset({
      tenantId: params.tenantId,
      category: params.category as any,
      fileName: file.fileName,
      body: file.body,
      contentType: file.contentType,
    });
    keys.push(key);
  }
  return keys;
}