import speakeasy from 'speakeasy';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || 'filitech-erp-totp-key-32chars!!';
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptTotpSecret(encryptedSecret: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateTotpSecret(): { secret: string; otpauthUrl: string } {
  const secret = speakeasy.generateSecret({
    name: 'Filitech ERP',
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  };
}

export function verifyTotpToken(encryptedSecret: string, token: string): boolean {
  try {
    const secret = decryptTotpSecret(encryptedSecret);
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });
  } catch {
    return false;
  }
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}
