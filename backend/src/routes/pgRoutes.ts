import { Router } from 'express';
import { 
  createPG, 
  updatePG,
  getOrganizationPGs, 
  allocateBedController,
  getPGRooms,
  createRoom,
  updateRoomController,
  deleteRoomController,
  updateBedController,
  getRoomHistory,
  payRent,
  payDeposit,
  refundDeposit,
  createComplaint,
  resolveComplaint,
  getPGComplaints,
  getPGComplaint,
  generateInvoicesManual,
  scanOverdueManual,
  getOverdueResidentsManual,
  sendReminderManual,
  saveTenantNoteManual
} from '../controllers/pgController';
import { getUnifiedPayments } from '../controllers/paymentController';
import { getLeads, createLead, updateLead, deleteLead } from '../controllers/leadController';
import {
  getRecoveriesLedger,
  getDamageRecoveryDashboard,
  updateRecoveryStatus,
  lockStaySettlement,
  getRecoveryAuditLogs
} from '../controllers/recoveriesController';
import dashboardRoutes from './dashboardRoutes';
import { getDashboardSummary } from '../controllers/dashboardController';
import { getUploadSignature, getSignedDocumentUrl } from '../controllers/uploadController';
import { addExpense, getExpensesTimeline } from '../controllers/expensesController';
import { getProfitSummary } from '../controllers/profitController';
import { 
  getVacancyImpact, 
  getFollowUps, 
  getCleaningChecklist, 
  toggleCleaningChecklist, 
  resetCleaningChecklist, 
  getOperationsSummary 
} from '../controllers/operationsController';
import { addStaff, getStaffList, deactivateStaff, payStaffSalary, getStaffDetails } from '../controllers/staffController';
import { requireAuth, attachOrgContext } from '../middlewares/authMiddleware';
import { canAccessOrganization, canAccessPG, auditAction } from '../middlewares/rbacMiddleware';

const router = Router();

// Secure all PG routes
router.use(requireAuth as any, attachOrgContext, canAccessOrganization);

// Uploads
router.get('/uploads/signature', getUploadSignature);
router.get('/uploads/document', getSignedDocumentUrl);

// Organization PGs
router.post('/', auditAction('CREATE_PG', 'PG'), createPG);
router.get('/', getOrganizationPGs);

// Specific PG operations (Requires canAccessPG)
router.get('/:pgId/dashboard/summary', canAccessPG, getDashboardSummary);
router.put('/:pgId', canAccessPG, updatePG);
router.use('/:pgId/dashboard', dashboardRoutes);

// PGRooms (Bed selector & Room History)
router.get('/:pgId/rooms', canAccessPG, getPGRooms);
router.post('/:pgId/rooms', canAccessPG, createRoom);
router.put('/:pgId/rooms/:roomId', canAccessPG, updateRoomController);
router.delete('/:pgId/rooms/:roomId', canAccessPG, deleteRoomController);
router.put('/:pgId/beds/:bedId', canAccessPG, updateBedController);
router.get('/:pgId/rooms/:roomId/history', canAccessPG, getRoomHistory);

// Unified Payments Route
router.get('/:pgId/payments', canAccessPG, getUnifiedPayments);

// Leads Module
router.get('/:pgId/leads', canAccessPG, getLeads);
router.post('/:pgId/leads', canAccessPG, createLead);
router.put('/:pgId/leads/:leadId', canAccessPG, updateLead);
router.delete('/:pgId/leads/:leadId', canAccessPG, deleteLead);

// Operations Mutations
router.post('/:pgId/tenants/:tenantId/pay-rent', canAccessPG, payRent);
router.post('/:pgId/tenants/:tenantId/pay-deposit', canAccessPG, payDeposit);
router.post('/:pgId/tenants/:tenantId/refund-deposit', canAccessPG, refundDeposit);
router.post('/:pgId/complaints', canAccessPG, createComplaint);
router.post('/:pgId/complaints/:complaintId/resolve', canAccessPG, resolveComplaint);
router.get('/:pgId/complaints', canAccessPG, getPGComplaints);
router.get('/:pgId/complaints/:complaintId', canAccessPG, getPGComplaint);

// Damage Recoveries & Settlement locking
router.get('/:pgId/recoveries/ledger', canAccessPG, getRecoveriesLedger);
router.get('/:pgId/recoveries/dashboard', canAccessPG, getDamageRecoveryDashboard);
router.post('/:pgId/recoveries/:recoveryId/status', canAccessPG, updateRecoveryStatus);
router.get('/:pgId/recoveries/:recoveryId/audit-logs', canAccessPG, getRecoveryAuditLogs);
router.post('/:pgId/tenants/:tenantId/lock-settlement', canAccessPG, lockStaySettlement);

// Automation & Notifications Manual Triggers
router.post('/:pgId/automation/generate-invoices', canAccessPG, generateInvoicesManual);
router.post('/:pgId/automation/scan-overdue', canAccessPG, scanOverdueManual);
router.post('/:pgId/notifications/send-reminder', canAccessPG, sendReminderManual);
router.get('/:pgId/automation/overdue-residents', canAccessPG, getOverdueResidentsManual);
router.post('/:pgId/tenants/:tenantId/notes', canAccessPG, saveTenantNoteManual);

// Bed Allocation
router.post(
  '/:pgId/beds/allocate',
  canAccessPG,
  auditAction('ALLOCATE_BED', 'PGTenantProfile'),
  allocateBedController
);

// Sprint 1 Operational Mappings
router.post('/:pgId/expenses', canAccessPG, addExpense);
router.get('/:pgId/expenses/timeline', canAccessPG, getExpensesTimeline);
router.get('/:pgId/profit/summary', canAccessPG, getProfitSummary);
router.get('/:pgId/operations/vacancy-impact', canAccessPG, getVacancyImpact);
router.get('/:pgId/operations/follow-ups', canAccessPG, getFollowUps);
router.get('/:pgId/cleaning/checklist', canAccessPG, getCleaningChecklist);
router.post('/:pgId/cleaning/checklist/toggle', canAccessPG, toggleCleaningChecklist);
router.post('/:pgId/cleaning/checklist/reset', canAccessPG, resetCleaningChecklist);
router.get('/:pgId/operations/summary', canAccessPG, getOperationsSummary);

// Sprint 2 Staff Mappings
router.get('/:pgId/staff', canAccessPG, getStaffList);
router.post('/:pgId/staff', canAccessPG, addStaff);
router.post('/:pgId/staff/:staffId/pay-salary', canAccessPG, payStaffSalary);
router.post('/:pgId/staff/:staffId/deactivate', canAccessPG, deactivateStaff);
router.get('/:pgId/staff/:staffId', canAccessPG, getStaffDetails);


export default router;
