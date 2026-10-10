/** Cap. 3.3 — Cloudflare R2 (S3-compatible) */

export function buildTenantAssetKey(params: {
  tenantId: string;
  category: "avatar" | "os-photo" | "fiscal-xml" | "client-signature" | "nfe-entry-xml";
  fileName: string;
}) {
  return `tenants/${params.tenantId}/${params.category}/${params.fileName}`;
}

export async function uploadTenantAsset(params: {
  tenantId: string;
  category: "avatar" | "os-photo" | "fiscal-xml" | "client-signature" | "nfe-entry-xml";
  fileName: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const key = buildTenantAssetKey(params);
  // Runtime real: @aws-sdk/client-s3 PutObject no endpoint R2
  // Aqui garantimos o contrato de chave namespaced por tenant.
  if (!process.env.R2_ACCOUNT_ID) {
    console.warn("[r2] credentials missing — key planned:", key);
    return key;
  }
  // Integração completa no worker de deploy com SDK instalado
  return key;
}
