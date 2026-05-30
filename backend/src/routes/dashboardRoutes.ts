import { Router } from 'express';
import { getTasks, getOccupancy, getActivity } from '../controllers/dashboardDataController';
import { getCollectionsHistory, getMonthlyCollectionLedger, getDepositLedger } from '../controllers/collectionsController';
import { requireAuth, attachOrgContext } from '../middlewares/authMiddleware';
import { canAccessPG } from '../middlewares/rbacMiddleware';

const router = Router({ mergeParams: true });

// Assume mounted at /api/pgs/:pgId/dashboard
router.use(requireAuth as any, attachOrgContext, canAccessPG);

router.get('/tasks', getTasks);
router.get('/occupancy', getOccupancy);
router.get('/activity', getActivity);
router.get('/collections-history', getCollectionsHistory);
router.get('/collections-history/:year/:month', getMonthlyCollectionLedger);
router.get('/deposits/ledger', getDepositLedger);

export default router;
