import { Router } from 'express';
import { searchByPhone, onboard, lockBedForOnboarding, vacate, getResidentProfile, settleMoveout, updateResidentProfile, getPGResidents } from '../controllers/tenantController';
import { requireAuth, attachOrgContext } from '../middlewares/authMiddleware';
import { canAccessOrganization, canAccessPG, auditAction } from '../middlewares/rbacMiddleware';

const router = Router();

// Secure all tenant routes
router.use(requireAuth as any, attachOrgContext, canAccessOrganization);

router.get('/search-by-phone', searchByPhone);
router.get('/profiles/:profileId', getResidentProfile);
router.get('/pgs/:pgId/residents', canAccessPG, getPGResidents);

router.post(
  '/pgs/:pgId/onboard',
  canAccessPG,
  auditAction('START_ONBOARDING', 'PGTenantProfile'),
  onboard
);

router.put(
  '/pgs/:pgId/tenants/:tenantId',
  canAccessPG,
  updateResidentProfile
);

router.post(
  '/beds/:bedId/lock',
  lockBedForOnboarding
);

router.post(
  '/pgs/:pgId/tenants/:tenantId/vacate',
  canAccessPG,
  auditAction('VACATE_RESIDENT', 'PGTenantProfile'),
  vacate
);

router.post(
  '/pgs/:pgId/tenants/:tenantId/settle-moveout',
  canAccessPG,
  settleMoveout
);

export default router;
