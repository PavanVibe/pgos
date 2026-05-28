"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantController_1 = require("../controllers/tenantController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const rbacMiddleware_1 = require("../middlewares/rbacMiddleware");
const router = (0, express_1.Router)();
// Secure all tenant routes
router.use(authMiddleware_1.requireAuth, authMiddleware_1.attachOrgContext, rbacMiddleware_1.canAccessOrganization);
router.get('/search-by-phone', tenantController_1.searchByPhone);
router.post('/pgs/:pgId/onboard', rbacMiddleware_1.canAccessPG, (0, rbacMiddleware_1.auditAction)('START_ONBOARDING', 'PGTenantProfile'), tenantController_1.onboard);
router.post('/beds/:bedId/lock', tenantController_1.lockBedForOnboarding);
router.post('/pgs/:pgId/tenants/:tenantId/vacate', rbacMiddleware_1.canAccessPG, (0, rbacMiddleware_1.auditAction)('VACATE_RESIDENT', 'PGTenantProfile'), tenantController_1.vacate);
exports.default = router;
//# sourceMappingURL=tenantRoutes.js.map