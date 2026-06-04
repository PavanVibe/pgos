"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffDetails = exports.payStaffSalary = exports.deactivateStaff = exports.getStaffList = exports.addStaff = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const zod_1 = require("zod");
const createStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(10),
    role: zod_1.z.string().min(1).default('CARETAKER'),
    monthlySalary: zod_1.z.number().nonnegative().default(0),
    joiningDate: zod_1.z.string().optional().transform(val => val ? new Date(val) : new Date())
});
const paySalarySchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    salaryMonth: zod_1.z.string().min(1), // e.g. "May 2026"
    notes: zod_1.z.string().optional()
});
const addStaff = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const orgId = req.auth?.orgId || req.body.organizationId;
        // Find organizationId dynamically if not present
        let finalOrgId = orgId;
        if (!finalOrgId) {
            const pg = await prisma_1.default.pG.findUnique({ where: { id: pgId } });
            finalOrgId = pg?.organizationId;
        }
        if (!finalOrgId) {
            return res.status(400).json({ error: 'Organization context is required.' });
        }
        const payload = createStaffSchema.parse(req.body);
        const staff = await prisma_1.default.staff.create({
            data: {
                organizationId: finalOrgId,
                pgId: pgId,
                name: payload.name,
                phone: payload.phone,
                role: payload.role.toUpperCase(),
                monthlySalary: payload.monthlySalary,
                joiningDate: payload.joiningDate,
                status: 'ACTIVE'
            }
        });
        res.status(200).json({ status: 'success', data: staff });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.addStaff = addStaff;
const getStaffList = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const staff = await prisma_1.default.staff.findMany({
            where: {
                pgId: pgId,
                isActive: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json({ status: 'success', data: staff });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getStaffList = getStaffList;
const deactivateStaff = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staff = await prisma_1.default.staff.update({
            where: { id: staffId },
            data: {
                status: 'INACTIVE'
            }
        });
        res.status(200).json({ status: 'success', data: staff });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.deactivateStaff = deactivateStaff;
const payStaffSalary = async (req, res) => {
    try {
        const { staffId } = req.params;
        const payload = paySalarySchema.parse(req.body);
        const payment = await prisma_1.default.staffSalaryPayment.create({
            data: {
                staffId: staffId,
                amount: payload.amount,
                salaryMonth: payload.salaryMonth,
                notes: payload.notes || null,
                paymentDate: new Date()
            }
        });
        res.status(200).json({ status: 'success', data: payment });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.payStaffSalary = payStaffSalary;
const getStaffDetails = async (req, res) => {
    try {
        const { staffId } = req.params;
        const staff = await prisma_1.default.staff.findUnique({
            where: { id: staffId },
            include: {
                salaryPayments: {
                    orderBy: {
                        paymentDate: 'desc'
                    }
                }
            }
        });
        if (!staff) {
            return res.status(404).json({ error: 'Staff profile not found.' });
        }
        res.status(200).json({ status: 'success', data: staff });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getStaffDetails = getStaffDetails;
//# sourceMappingURL=staffController.js.map