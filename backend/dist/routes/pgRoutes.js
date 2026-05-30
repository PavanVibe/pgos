"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pgController_1 = require("../controllers/pgController");
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const dashboardController_1 = require("../controllers/dashboardController");
const uploadController_1 = require("../controllers/uploadController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const rbacMiddleware_1 = require("../middlewares/rbacMiddleware");
const router = (0, express_1.Router)();
// Secure all PG routes
router.use(authMiddleware_1.requireAuth, authMiddleware_1.attachOrgContext, rbacMiddleware_1.canAccessOrganization);
// Uploads
router.get('/uploads/signature', uploadController_1.getUploadSignature);
router.get('/uploads/document', uploadController_1.getSignedDocumentUrl);
// Organization PGs
router.post('/', (0, rbacMiddleware_1.auditAction)('CREATE_PG', 'PG'), pgController_1.createPG);
router.get('/', pgController_1.getOrganizationPGs);
// Specific PG operations (Requires canAccessPG)
router.get('/:pgId/dashboard/summary', rbacMiddleware_1.canAccessPG, dashboardController_1.getDashboardSummary);
router.use('/:pgId/dashboard', dashboardRoutes_1.default);
// PGRooms (Bed selector & Room History)
router.get('/:pgId/rooms', rbacMiddleware_1.canAccessPG, pgController_1.getPGRooms);
router.post('/:pgId/rooms', rbacMiddleware_1.canAccessPG, pgController_1.createRoom);
router.get('/:pgId/rooms/:roomId/history', rbacMiddleware_1.canAccessPG, pgController_1.getRoomHistory);
// Operations Mutations
router.post('/:pgId/tenants/:tenantId/pay-rent', rbacMiddleware_1.canAccessPG, pgController_1.payRent);
router.post('/:pgId/tenants/:tenantId/pay-deposit', rbacMiddleware_1.canAccessPG, pgController_1.payDeposit);
router.post('/:pgId/complaints', rbacMiddleware_1.canAccessPG, pgController_1.createComplaint);
router.post('/:pgId/complaints/:complaintId/resolve', rbacMiddleware_1.canAccessPG, pgController_1.resolveComplaint);
router.get('/:pgId/complaints', rbacMiddleware_1.canAccessPG, pgController_1.getPGComplaints);
router.get('/:pgId/complaints/:complaintId', rbacMiddleware_1.canAccessPG, pgController_1.getPGComplaint);
// Automation & Notifications Manual Triggers
router.post('/:pgId/automation/generate-invoices', rbacMiddleware_1.canAccessPG, pgController_1.generateInvoicesManual);
router.post('/:pgId/automation/scan-overdue', rbacMiddleware_1.canAccessPG, pgController_1.scanOverdueManual);
router.post('/:pgId/notifications/send-reminder', rbacMiddleware_1.canAccessPG, pgController_1.sendReminderManual);
router.get('/:pgId/automation/overdue-residents', rbacMiddleware_1.canAccessPG, pgController_1.getOverdueResidentsManual);
router.post('/:pgId/tenants/:tenantId/notes', rbacMiddleware_1.canAccessPG, pgController_1.saveTenantNoteManual);
// Bed Allocation
router.post('/:pgId/beds/allocate', rbacMiddleware_1.canAccessPG, (0, rbacMiddleware_1.auditAction)('ALLOCATE_BED', 'PGTenantProfile'), pgController_1.allocateBedController);
exports.default = router;
//# sourceMappingURL=pgRoutes.js.map