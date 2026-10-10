import { Router } from 'express';
import { prisma } from '../infra/prisma';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireRole('OWNER'));

adminRouter.get('/dashboard/stats', async (_req, res, next) => {
  try {
    const [totalTenants, activeTenants, totalUsers, totalSales, recentTenants] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.sale.count({ where: { status: 'COMPLETED' } }),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { subscriptions: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalSales,
        recentTenants,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/tenants', async (req, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;

    const where = status ? { status: status as string } : {};

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: { subscriptions: true, users: { select: { id: true, name: true, email: true, role: true } } },
        skip: (parseInt(page as string) - 1) * parseInt(limit as string),
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({ success: true, data: { items: tenants, total }, error: null });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/tenants/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json({ success: true, data: tenant, error: null });
  } catch (err) {
    next(err);
  }
});
