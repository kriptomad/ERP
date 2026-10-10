import { prismaUnscoped, TenantType, UserRole } from "@filitech/database";
import { hashPassword } from "../../auth/password.service";
import { randomUUID } from "crypto";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function onboardBusiness(input: {
  tradeName: string;
  legalName: string;
  cnpj: string;
  slug?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  termsVersion: string;
  privacyVersion: string;
}) {
  const passwordHash = await hashPassword(input.ownerPassword);
  const plan = await prismaUnscoped.plan.findFirstOrThrow({
    where: { code: "BASIC", audience: "BUSINESS" },
  });
  const now = new Date();
  return prismaUnscoped.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: input.slug || slugify(input.tradeName),
        legalName: input.legalName,
        tradeName: input.tradeName,
        cnpj: input.cnpj.replace(/\D/g, ""),
        tenantType: TenantType.BUSINESS,
        status: "ACTIVE",
        termsAcceptedAt: now,
        termsVersionAccepted: input.termsVersion,
        privacyPolicyAcceptedAt: now,
        privacyPolicyVersionAccepted: input.privacyVersion,
      },
    });
    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.ownerName,
        email: input.ownerEmail.toLowerCase(),
        passwordHash,
        role: UserRole.OWNER,
      },
    });
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        provider: "internal",
        externalSubscriptionId: `trial_${tenant.id}`,
        status: "TRIAL",
        currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
      },
    });
    return { tenant, owner };
  });
}

export async function onboardPersonal(input: {
  householdName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  termsVersion: string;
  privacyVersion: string;
  invitePartnerEmail?: string;
}) {
  const passwordHash = await hashPassword(input.ownerPassword);
  const plan = await prismaUnscoped.plan.findFirstOrThrow({
    where: { code: "PERSONAL_FREE", audience: "PERSONAL" },
  });
  const now = new Date();
  const slug = `casa-${slugify(input.householdName)}-${randomUUID().slice(0, 6)}`;
  return prismaUnscoped.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        legalName: input.householdName,
        tradeName: input.householdName,
        tenantType: TenantType.PERSONAL,
        status: "ACTIVE",
        termsAcceptedAt: now,
        termsVersionAccepted: input.termsVersion,
        privacyPolicyAcceptedAt: now,
        privacyPolicyVersionAccepted: input.privacyVersion,
      },
    });
    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.ownerName,
        email: input.ownerEmail.toLowerCase(),
        passwordHash,
        role: UserRole.OWNER,
      },
    });
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        provider: "internal",
        externalSubscriptionId: `personal_${tenant.id}`,
        status: "ACTIVE",
      },
    });
    if (input.invitePartnerEmail) {
      const inviteToken = randomUUID();
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: "Convidado(a)",
          email: input.invitePartnerEmail.toLowerCase(),
          passwordHash: await hashPassword(inviteToken),
          role: UserRole.HOUSEHOLD_MEMBER,
          invitePending: true,
          inviteToken,
        },
      });
    }
    return { tenant, owner };
  });
}

export async function onboardAccountingOffice(input: {
  tradeName: string;
  legalName: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  termsVersion: string;
  privacyVersion: string;
  displayName: string;
  servicesOffered: string[];
}) {
  const passwordHash = await hashPassword(input.ownerPassword);
  const now = new Date();
  return prismaUnscoped.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: slugify(input.tradeName),
        legalName: input.legalName,
        tradeName: input.tradeName,
        cnpj: input.cnpj.replace(/\D/g, ""),
        tenantType: TenantType.ACCOUNTING_OFFICE,
        status: "ACTIVE",
        termsAcceptedAt: now,
        termsVersionAccepted: input.termsVersion,
        privacyPolicyAcceptedAt: now,
        privacyPolicyVersionAccepted: input.privacyVersion,
      },
    });
    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.ownerName,
        email: input.ownerEmail.toLowerCase(),
        passwordHash,
        role: UserRole.OWNER,
      },
    });
    await tx.accountingFirmProfile.create({
      data: {
        tenantId: tenant.id,
        displayName: input.displayName,
        servicesOffered: input.servicesOffered,
        isListedInMarketplace: false,
      },
    });
    return { tenant, owner };
  });
}
