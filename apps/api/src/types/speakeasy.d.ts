declare module 'speakeasy' {
  export interface GeneratedSecret {
    base32: string;
    otpauth_url?: string;
  }

  export interface TotpVerifyOptions {
    secret: string;
    encoding: string;
    token: string;
    window?: number;
  }

  export const generateSecret: (options: { name?: string; length?: number }) => GeneratedSecret;
  export const totp: {
    verify: (options: TotpVerifyOptions) => boolean;
  };
}
