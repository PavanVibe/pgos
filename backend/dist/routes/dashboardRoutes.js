"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboardDataController_1 = require("../controllers/dashboardDataController");
const collectionsController_1 = require("../controllers/collectionsController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const rbacMiddleware_1 = require("../middlewares/rbacMiddleware");
const router = (0, express_1.Router)({ mergeParams: true });
// Assume mounted at /api/pgs/:pgId/dashboard
router.use(authMiddleware_1.requireAuth, authMiddleware_1.attachOrgContext, rbacMiddleware_1.canAccessPG);
router.get('/tasks', dashboardDataController_1.getTasks);
router.get('/occupancy', dashboardDataController_1.getOccupancy);
router.get('/activity', dashboardDataController_1.getActivity);
router.get('/collections-history', collectionsController_1.getCollectionsHistory);
router.get('/collections-history/:year/:month', collectionsController_1.getMonthlyCollectionLedger);
exports.default = router;
//# sourceMappingURL=dashboardRoutes.js.map