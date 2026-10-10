import { prisma } from '../infra/prisma';
import { hashPassword, verifyPassword } from './password.service';
import { signSessionToken } from './jwt.service';
import { DomainError } from '../middlewares/error-handler.middleware';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  tradeName: string;
  legalName: string;
  cnpj?: string;
  niche?: string;
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email },
    include: { tenant: true },
  });

  if (!user || !user.active) {
    throw new DomainError('UNAUTHORIZED', 'Credenciais inválidas.');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new DomainError('UNAUTHORIZED', 'Credenciais inválidas.');
  }

  if (user.tenant.status === 'SUSPENDED') {
    throw new DomainError('FORBIDDEN', 'Conta suspensa. Entre em contato com o suporte.');
  }

  const token = signSessionToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant: {
        id: user.tenant.id,
        tradeName: user.tenant.tradeName,
        status: user.tenant.status,
      },
    },
  };
}

export async function register(input: RegisterInput) {
  const existingUser = await prisma.user.findFirst({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new DomainError('CONFLICT', 'Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(input.password);

  const tenant = await prisma.tenant.create({
    data: {
      slug: input.tradeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30),
      legalName: input.legalName,
      tradeName: input.tradeName,
      cnpj: input.cnpj,
      status: 'TRIAL',
      users: {
        create: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: 'OWNER',
        },
      },
    },
    include: { users: true },
  });

  const owner = tenant.users[0];
  const token = signSessionToken({
    userId: owner.id,
    tenantId: tenant.id,
    role: 'OWNER',
  });

  return {
    token,
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
      tenant: {
        id: tenant.id,
        tradeName: tenant.tradeName,
        status: tenant.status,
      },
    },
  };
}
