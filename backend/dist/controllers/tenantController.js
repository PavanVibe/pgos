"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vacate = exports.lockBedForOnboarding = exports.onboard = exports.searchByPhone = void 0;
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
    isQuickAdd: zod_1.z.boolean().default(false)
});
const onboard = async (req, res) => {
    try {
        const { pgId } = req.params;
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
        const profile = await OnboardResidentWorkflow_1.OnboardResidentWorkflow.execute(pgId, payload.bedId, payload.phone, payload.name, payload.email || undefined, new Date(payload.moveInDate), payload.monthlyRent, payload.securityDeposit, actorId, payload.isQuickAdd);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        if (error.message && error.message.includes('already occupied')) {
            return res.status(409).json({ error: error.message });
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
        const { pgId, tenantId } = req.params;
        const actorId = req.auth?.userId || 'system';
        const profile = await VacateResidentWorkflow_1.VacateResidentWorkflow.execute(pgId, tenantId, actorId);
        res.status(200).json({ status: 'success', data: profile });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.vacate = vacate;
//# sourceMappingURL=tenantController.js.map