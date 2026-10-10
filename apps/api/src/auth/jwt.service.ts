import { readFileSync } from "fs";
import jwt from "jsonwebtoken";

export interface SessionClaims {
  userId: string;
  tenantId: string;
  role: string;
}

function keys() {
  const priv = process.env.JWT_PRIVATE_KEY_PATH;
  const pub = process.env.JWT_PUBLIC_KEY_PATH;
  if (!priv || !pub) throw new Error("JWT keys missing");
  return {
    privateKey: readFileSync(priv, "utf8"),
    publicKey: readFileSync(pub, "utf8"),
  };
}

export function signSessionToken(claims: SessionClaims) {
  const { privateKey } = keys();
  return jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    expiresIn: "8h",
    issuer: process.env.JWT_ISSUER ?? "filitech-erp",
  });
}

export function verifySessionToken(token: string): SessionClaims {
  const { publicKey } = keys();
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: process.env.JWT_ISSUER ?? "filitech-erp",
  }) as SessionClaims;
}
