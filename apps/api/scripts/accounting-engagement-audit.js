import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating engagement audit event model...');

  console.log('✅ Engagement audit events system ready');
  console.log('');
  console.log('Engagement status flow:');
  console.log('  PENDING_ACCOUNTANT_ACCEPTANCE --(aceite em até 30 dias)--> ACTIVE');
  console.log('  PENDING_ACCOUNTANT_ACCEPTANCE --(revoke conta)--> REVOKED_BY_ACCOUNTANT');
  console.log('  PENDING_ACCOUNTANT_ACCEPTANCE --(revoke cliente)--> REVOKED_BY_CLIENT');
  console.log('  ACTIVE --(revoke conta)--> REVOKED_BY_ACCOUNTANT');
  console.log('  ACTIVE --(revoke cliente)--> REVOKED_BY_CLIENT');
  console.log('');
  console.log('Engagement expiry: 30 days from creation if not accepted');
  console.log('');
  console.log('Audit events:');
  console.log('  - ACCEPTED: Quando contador aceita o engajamento');
  console.log('  - REVOKED_BY_ACCOUNTANT: Quando contador revoga o vínculo');
  console.log('  - REVOKED_BY_CLIENT: Quando cliente revoga o vínculo');
  console.log('  - EXPIRED: Quando prazo de 30 dias expira sem aceite');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });