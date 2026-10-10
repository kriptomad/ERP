import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/auth.middleware';
import { tenantService } from './tenant.service';

export const tenantRouter = Router();

tenantRouter.use(authenticate);

tenantRouter.get('/:id', async (req, res, next) => {
  try {
    const tenant = await tenantService.findById(req.params.id);
    if (!tenant) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } });
      return;
    }
    res.json({ success: true, data: tenant, error: null });
  } catch (err) {
    next(err);
  }
});

tenantRouter.get('/slug/:slug', async (req, res, next) => {
  try {
    const tenant = await tenantService.findBySlug(req.params.slug);
    if (!tenant) {
      res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Tenant não encontrado.' } });
      return;
    }
    res.json({ success: true, data: tenant, error: null });
  } catch (err) {
    next(err);
  }
});

tenantRouter.get('/:id/modules', async (req, res, next) => {
  try {
    const modules = await tenantService.listModules(req.params.id);
    res.json({ success: true, data: modules, error: null });
  } catch (err) {
    next(err);
  }
});

const activateModuleSchema = z.object({
  moduleCode: z.string(),
});

tenantRouter.post('/:id/modules/activate', async (req, res, next) => {
  try {
    const { moduleCode } = activateModuleSchema.parse(req.body);
    const result = await tenantService.activateModule(req.params.id, moduleCode);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

tenantRouter.post('/:id/modules/deactivate', async (req, res, next) => {
  try {
    const { moduleCode } = activateModuleSchema.parse(req.body);
    const result = await tenantService.deactivateModule(req.params.id, moduleCode);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});
