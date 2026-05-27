import { Router } from 'express';
import { getTasks, getOccupancy, getActivity } from '../controllers/dashboardDataController';
import { requireAuth, attachOrgContext } from '../middlewares/authMiddleware';
import { canAccessPG } from '../middlewares/rbacMiddleware';

const router = Router({ mergeParams: true });

// Assume mounted at /api/pgs/:pgId/dashboard
router.use(requireAuth as any, attachOrgContext, canAccessPG);

router.get('/tasks', getTasks);
router.get('/occupancy', getOccupancy);
router.get('/activity', getActivity);

export default router;
