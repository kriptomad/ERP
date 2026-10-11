import { prisma } from '../../infra/prisma';
import { logger } from '../../logging/structured-logger';

interface LegalConsent {
  termsVersionAccepted: string;
  privacyPolicyVersionAccepted: string;
  termsAcceptedAt: Date;
  privacyPolicyAcceptedAt: Date;
  ipAddress: string;
  userAgent: string;
}

export async function recordLegalConsent(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<LegalConsent> {
  const now = new Date();

  // Definir versões atuais (seriam definidas no SystemParameter)
  const currentTermsVersion = '2025-01-v1';
  const currentPrivacyVersion = '2025-01-v1';

  // Registrar consentimento no usuario existente (criado no cadastro)
  await prisma.user.update({
    where: { id: userId },
    data: {
      termsVersionAccepted: currentTermsVersion,
      privacyPolicyVersionAccepted: currentPrivacyVersion,
      termsAcceptedAt: now,
      privacyPolicyAcceptedAt: now,
    },
  });








  // Registrar evento de auditoria imutável
  await prisma.auditLog.create({
    data: {
      action: 'LEGAL_CONSENT_RECORDED',
      resource: 'User',
      resourceId: userId,
      changes: {
        termsVersion: currentTermsVersion,
        privacyPolicyVersion: currentPrivacyVersion,
      },
      ip: ipAddress,
      userAgent,
    },
  });

  logger.info('Legal consent recorded', { userId, termsVersion: currentTermsVersion, privacyPolicyVersion: currentPrivacyVersion });

  return {
    termsVersionAccepted: currentTermsVersion,
    privacyPolicyVersionAccepted: currentPrivacyVersion,
    termsAcceptedAt: now,
    privacyPolicyAcceptedAt: now,
    ipAddress,
    userAgent,
  };
}

export async function verifyLegalConsent(userId: string): Promise<{
  valid: boolean;
  termsVersion: string;
  privacyPolicyVersion: string;
  daysSinceTerms: number;
  daysSincePrivacy: number;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { valid: false, termsVersion: '', privacyPolicyVersion: '', daysSinceTerms: 0, daysSincePrivacy: 0 };
  }

  const termsVersion = user.termsVersionAccepted ?? '';
  const privacyPolicyVersion = user.privacyPolicyVersionAccepted ?? '';
  const now = new Date();

  // Versões têm formato 2025-01-v1; extrair para comparação
  // A política de retenção é de 5-6 anos conforme documento
  const daysSinceTerms = Math.floor((now.getTime() - user.termsAcceptedAt!.getTime()) / (1000 * 60 * 60 * 24));
  const daysSincePrivacy = Math.floor((now.getTime() - user.privacyPolicyAcceptedAt!.getTime()) / (1000 * 60 * 60 * 24));

  const valid = !!(
    user.termsAcceptedAt &&
    user.privacyPolicyAcceptedAt &&
    daysSinceTerms < 3650 && // 10 anos, seguro para LGPD
    daysSincePrivacy < 3650
  );

  return {
    valid,
    termsVersion,
    privacyPolicyVersion,
    daysSinceTerms,
    daysSincePrivacy,
  };
}

export async function getLegalDocumentVersions(): Promise<{
  terms: { version: string; releasedAt: Date; changes: string[] };
  privacyPolicy: { version: string; releasedAt: Date; changes: string[] };
}> {
  // Em produção, esses dados viriam de um cadastro de leiautes oficiais
  // ou do SystemParameter
  const now = new Date();

  const terms = {
    version: '2025-01-v1',
    releasedAt: now,
    changes: 'Política de privacidade atualizada; inclusão de dados anonimizados; direitos do titular'.split('; '),
  };

  const privacyPolicy = {
    version: '2025-01-v1',
    releasedAt: now,
    changes: 'Atendimento à LC 13.709/2018 (LGPD); base de legítima interesting; armazenamento por 5 anos'.split('; '),
  };

  return { terms, privacyPolicy };
};
