"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pgController_1 = require("../controllers/pgController");
const paymentController_1 = require("../controllers/paymentController");
const leadController_1 = require("../controllers/leadController");
const recoveriesController_1 = require("../controllers/recoveriesController");
const dashboardRoutes_1 = __importDefault(require("./dashboardRoutes"));
const dashboardController_1 = require("../controllers/dashboardController");
const uploadController_1 = require("../controllers/uploadController");
const expensesController_1 = require("../controllers/expensesController");
const profitController_1 = require("../controllers/profitController");
const operationsController_1 = require("../controllers/operationsController");
const staffController_1 = require("../controllers/staffController");
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
router.put('/:pgId', rbacMiddleware_1.canAccessPG, pgController_1.updatePG);
router.use('/:pgId/dashboard', dashboardRoutes_1.default);
// PGRooms (Bed selector & Room History)
router.get('/:pgId/rooms', rbacMiddleware_1.canAccessPG, pgController_1.getPGRooms);
router.post('/:pgId/rooms', rbacMiddleware_1.canAccessPG, pgController_1.createRoom);
router.put('/:pgId/rooms/:roomId', rbacMiddleware_1.canAccessPG, pgController_1.updateRoomController);
router.delete('/:pgId/rooms/:roomId', rbacMiddleware_1.canAccessPG, pgController_1.deleteRoomController);
router.put('/:pgId/beds/:bedId', rbacMiddleware_1.canAccessPG, pgController_1.updateBedController);
router.get('/:pgId/rooms/:roomId/history', rbacMiddleware_1.canAccessPG, pgController_1.getRoomHistory);
// Unified Payments Route
router.get('/:pgId/payments', rbacMiddleware_1.canAccessPG, paymentController_1.getUnifiedPayments);
// Leads Module
router.get('/:pgId/leads', rbacMiddleware_1.canAccessPG, leadController_1.getLeads);
router.post('/:pgId/leads', rbacMiddleware_1.canAccessPG, leadController_1.createLead);
router.put('/:pgId/leads/:leadId', rbacMiddleware_1.canAccessPG, leadController_1.updateLead);
router.delete('/:pgId/leads/:leadId', rbacMiddleware_1.canAccessPG, leadController_1.deleteLead);
// Operations Mutations
router.post('/:pgId/tenants/:tenantId/pay-rent', rbacMiddleware_1.canAccessPG, pgController_1.payRent);
router.post('/:pgId/tenants/:tenantId/pay-deposit', rbacMiddleware_1.canAccessPG, pgController_1.payDeposit);
router.post('/:pgId/tenants/:tenantId/refund-deposit', rbacMiddleware_1.canAccessPG, pgController_1.refundDeposit);
router.post('/:pgId/complaints', rbacMiddleware_1.canAccessPG, pgController_1.createComplaint);
router.post('/:pgId/complaints/:complaintId/resolve', rbacMiddleware_1.canAccessPG, pgController_1.resolveComplaint);
router.get('/:pgId/complaints', rbacMiddleware_1.canAccessPG, pgController_1.getPGComplaints);
router.get('/:pgId/complaints/:complaintId', rbacMiddleware_1.canAccessPG, pgController_1.getPGComplaint);
// Damage Recoveries & Settlement locking
router.get('/:pgId/recoveries/ledger', rbacMiddleware_1.canAccessPG, recoveriesController_1.getRecoveriesLedger);
router.get('/:pgId/recoveries/dashboard', rbacMiddleware_1.canAccessPG, recoveriesController_1.getDamageRecoveryDashboard);
router.post('/:pgId/recoveries/:recoveryId/status', rbacMiddleware_1.canAccessPG, recoveriesController_1.updateRecoveryStatus);
router.get('/:pgId/recoveries/:recoveryId/audit-logs', rbacMiddleware_1.canAccessPG, recoveriesController_1.getRecoveryAuditLogs);
router.post('/:pgId/tenants/:tenantId/lock-settlement', rbacMiddleware_1.canAccessPG, recoveriesController_1.lockStaySettlement);
// Automation & Notifications Manual Triggers
router.post('/:pgId/automation/generate-invoices', rbacMiddleware_1.canAccessPG, pgController_1.generateInvoicesManual);
router.post('/:pgId/automation/scan-overdue', rbacMiddleware_1.canAccessPG, pgController_1.scanOverdueManual);
router.post('/:pgId/notifications/send-reminder', rbacMiddleware_1.canAccessPG, pgController_1.sendReminderManual);
router.get('/:pgId/automation/overdue-residents', rbacMiddleware_1.canAccessPG, pgController_1.getOverdueResidentsManual);
router.post('/:pgId/tenants/:tenantId/notes', rbacMiddleware_1.canAccessPG, pgController_1.saveTenantNoteManual);
// Bed Allocation
router.post('/:pgId/beds/allocate', rbacMiddleware_1.canAccessPG, (0, rbacMiddleware_1.auditAction)('ALLOCATE_BED', 'PGTenantProfile'), pgController_1.allocateBedController);
// Sprint 1 Operational Mappings
router.post('/:pgId/expenses', rbacMiddleware_1.canAccessPG, expensesController_1.addExpense);
router.get('/:pgId/expenses/timeline', rbacMiddleware_1.canAccessPG, expensesController_1.getExpensesTimeline);
router.get('/:pgId/profit/summary', rbacMiddleware_1.canAccessPG, profitController_1.getProfitSummary);
router.get('/:pgId/operations/vacancy-impact', rbacMiddleware_1.canAccessPG, operationsController_1.getVacancyImpact);
router.get('/:pgId/operations/follow-ups', rbacMiddleware_1.canAccessPG, operationsController_1.getFollowUps);
router.get('/:pgId/cleaning/checklist', rbacMiddleware_1.canAccessPG, operationsController_1.getCleaningChecklist);
router.post('/:pgId/cleaning/checklist/toggle', rbacMiddleware_1.canAccessPG, operationsController_1.toggleCleaningChecklist);
router.post('/:pgId/cleaning/checklist/reset', rbacMiddleware_1.canAccessPG, operationsController_1.resetCleaningChecklist);
router.get('/:pgId/operations/summary', rbacMiddleware_1.canAccessPG, operationsController_1.getOperationsSummary);
// Sprint 2 Staff Mappings
router.get('/:pgId/staff', rbacMiddleware_1.canAccessPG, staffController_1.getStaffList);
router.post('/:pgId/staff', rbacMiddleware_1.canAccessPG, staffController_1.addStaff);
router.post('/:pgId/staff/:staffId/pay-salary', rbacMiddleware_1.canAccessPG, staffController_1.payStaffSalary);
router.post('/:pgId/staff/:staffId/deactivate', rbacMiddleware_1.canAccessPG, staffController_1.deactivateStaff);
router.get('/:pgId/staff/:staffId', rbacMiddleware_1.canAccessPG, staffController_1.getStaffDetails);
exports.default = router;
//# sourceMappingURL=pgRoutes.js.map