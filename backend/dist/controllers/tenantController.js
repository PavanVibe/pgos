"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResidentProfile = exports.vacate = exports.lockBedForOnboarding = exports.onboard = exports.searchByPhone = void 0;
const tenantService_1 = require("../services/tenantService");
const OnboardResidentWorkflow_1 = require("../services/workflows/OnboardResidentWorkflow");
const VacateResidentWorkflow_1 = require("../services/workflows/VacateResidentWorkflow");
const lockService_1 = require("../services/lockService");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../utils/prisma"));
const client_1 = require("@prisma/client");
const searchByPhone = async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        const tenant = await (0, tenantService_1.searchTenantByPhone)(phone);
        if (!tenant) {
            return res.status(404).json({ status: 'not_found' });
        }
        res.status(200).json({ status: 'success', data: tenant });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.searchByPhone = searchByPhone;
const onboardSchema = zod_1.z.object({
    bedId: zod_1.z.string(),
    phone: zod_1.z.string().min(10),
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    moveInDate: zod_1.z.string(),
    monthlyRent: zod_1.z.number().positive(),
    securityDeposit: zod_1.z.number().nonnegative(),
    isQuickAdd: zod_1.z.boolean().default(false),
    kycDocUrl: zod_1.z.string().optional(),
    bypassEmailCheck: zod_1.z.boolean().optional(),
    transferResident: zod_1.z.boolean().optional(),
    depositCollected: zod_1.z.boolean().default(false),
    depositPaymentMode: zod_1.z.string().optional(),
    depositCollectedAt: zod_1.z.string().optional()
});
const onboard = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const actorId = req.auth?.userId || 'system';
        const payload = onboardSchema.parse(req.body);
        // Pre-flight database check to see if the bed is already occupied by an active, notice, or incomplete profile
        const activeProfile = await prisma_1.default.pGTenantProfile.findFirst({
            where: {
                bedId: payload.bedId,
                status: {
                    in: [client_1.TenantStatus.ACTIVE, client_1.TenantStatus.INCOMPLETE, client_1.TenantStatus.NOTICE]
                }
            }
        });
        if (activeProfile) {
            return res.status(409).json({ error: 'Bed already occupied. Refresh occupancy map.' });
        }
        const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pgId, payload.bedId, payload.phone, payload.name, payload.email || undefined, new Date(payload.moveInDate), payload.monthlyRent, payload.securityDeposit, actorId, payload.isQuickAdd, payload.kycDocUrl, payload.bypassEmailCheck || false, payload.transferResident || false, payload.depositCollected, payload.depositPaymentMode, payload.depositCollectedAt ? new Date(payload.depositCollectedAt) : undefined);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        if (error.message && error.message.includes('already occupied')) {
            return res.status(409).json({ error: error.message });
        }
        if (error.message && error.message.startsWith('WARNING_ACTIVE_OCCUPANCY:')) {
            const parts = error.message.split(':');
            return res.status(200).json({
                status: 'warning',
                code: 'ACTIVE_OCCUPANCY',
                allocation: {
                    roomNumber: parts[1],
                    bedLabel: parts[2],
                    profileId: parts[3]
                }
            });
        }
        if (error.message && error.message.startsWith('WARNING_EMAIL_EXISTS:')) {
            const parts = error.message.split(':');
            return res.status(200).json({
                status: 'warning',
                code: 'EMAIL_EXISTS',
                tenant: {
                    id: parts[1],
                    name: parts[2],
                    phone: parts[3],
                    email: parts[4]
                }
            });
        }
        if (error.message && error.message === 'CONFLICT_DIFFERENT_RECORDS') {
            return res.status(409).json({
                error: 'Conflict: Phone number belongs to one resident, while email belongs to another. Automatic merge blocked.'
            });
        }
        res.status(400).json({ error: error.message });
    }
};
exports.onboard = onboard;
const lockBedForOnboarding = async (req, res) => {
    try {
        const { bedId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const success = await (0, lockService_1.lockBed)(bedId, actorId);
        if (!success) {
            return res.status(409).json({ error: 'Bed is currently locked by another operation.' });
        }
        res.status(200).json({ status: 'success', message: 'Bed locked for 5 minutes.' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.lockBedForOnboarding = lockBedForOnboarding;
const vacate = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const { tenantId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const profile = await VacateResidentWorkflow_1.VacateResidentWorkflow.execute(pgId, tenantId, actorId);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.vacate = vacate;
const getResidentProfile = async (req, res) => {
    try {
        const { profileId } = req.params;
        if (!profileId) {
            return res.status(400).json({ error: 'profileId is required.' });
        }
        const profile = await prisma_1.default.pGTenantProfile.findUnique({
            where: { id: profileId },
            include: {
                globalTenant: true,
                bed: {
                    include: {
                        room: true
                    }
                },
                room: true,
                invoices: {
                    orderBy: { dueDate: 'desc' }
                },
                complaints: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Resident stay profile not found.' });
        }
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getResidentProfile = getResidentProfile;
//# sourceMappingURL=tenantController.js.map