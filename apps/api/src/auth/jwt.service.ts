import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface SessionClaims {
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'MANAGER' | 'TECHNICIAN' | 'CASHIER';
}

function getPrivateKey(): string {
  const keyPath = process.env.JWT_PRIVATE_KEY_PATH || './keys/jwt-private.pem';
  try {
    return readFileSync(resolve(keyPath), 'utf8');
  } catch {
    return process.env.JWT_PRIVATE_KEY || 'dev-private-key';
  }
}

function getPublicKey(): string {
  const keyPath = process.env.JWT_PUBLIC_KEY_PATH || './keys/jwt-public.pem';
  try {
    return readFileSync(resolve(keyPath), 'utf8');
  } catch {
    return process.env.JWT_PUBLIC_KEY || 'dev-public-key';
  }
}

export function signSessionToken(claims: SessionClaims): string {
  const privateKey = getPrivateKey();
  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    expiresIn,
    issuer: process.env.JWT_ISSUER || 'filitech-erp',
  });
}

export function verifySessionToken(token: string): SessionClaims {
  const publicKey = getPublicKey();
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: process.env.JWT_ISSUER || 'filitech-erp',
  }) as SessionClaims;
}
