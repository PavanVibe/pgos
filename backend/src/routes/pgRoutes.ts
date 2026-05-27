import { Router } from 'express';
import { 
  createPG, 
  getOrganizationPGs, 
  allocateBedController,
  getPGRooms,
  getRoomHistory,
  payRent,
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
import dashboardRoutes from './dashboardRoutes';
import { getDashboardSummary } from '../controllers/dashboardController';
import { getUploadSignature, getSignedDocumentUrl } from '../controllers/uploadController';
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
router.use('/:pgId/dashboard', dashboardRoutes);

// PGRooms (Bed selector & Room History)
router.get('/:pgId/rooms', canAccessPG, getPGRooms);
router.get('/:pgId/rooms/:roomId/history', canAccessPG, getRoomHistory);

// Operations Mutations
router.post('/:pgId/tenants/:tenantId/pay-rent', canAccessPG, payRent);
router.post('/:pgId/complaints', canAccessPG, createComplaint);
router.post('/:pgId/complaints/:complaintId/resolve', canAccessPG, resolveComplaint);
router.get('/:pgId/complaints', canAccessPG, getPGComplaints);
router.get('/:pgId/complaints/:complaintId', canAccessPG, getPGComplaint);

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


export default router;
