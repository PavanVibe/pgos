"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLead = exports.updateLead = exports.createLead = exports.getLeads = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const zod_1 = require("zod");
const createLeadSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    phone: zod_1.z.string().min(10),
    source: zod_1.z.string(),
    interestedRoomId: zod_1.z.string().optional().nullable(),
    expectedMoveIn: zod_1.z.string().optional().nullable(),
});
const updateLeadSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    interestedRoomId: zod_1.z.string().optional().nullable(),
    expectedMoveIn: zod_1.z.string().optional().nullable(),
    status: zod_1.z.string().optional(),
});
const getLeads = async (req, res) => {
    try {
        const pgId = (req.pg?.id || req.params.pgId);
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const { status } = req.query;
        const whereClause = { pgId };
        if (status && typeof status === 'string') {
            whereClause.status = status;
        }
        const leads = await prisma_1.default.lead.findMany({
            where: whereClause,
            include: {
                interestedRoom: {
                    select: { id: true, number: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ status: 'success', data: leads });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getLeads = getLeads;
const createLead = async (req, res) => {
    try {
        const pgId = (req.pg?.id || req.params.pgId);
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const { name, phone, source, interestedRoomId, expectedMoveIn } = createLeadSchema.parse(req.body);
        const lead = await prisma_1.default.lead.create({
            data: {
                pgId,
                name,
                phone,
                source,
                interestedRoomId: interestedRoomId || null,
                expectedMoveIn: expectedMoveIn ? new Date(expectedMoveIn) : null,
                status: 'NEW_LEAD',
            },
            include: {
                interestedRoom: {
                    select: { id: true, number: true }
                }
            }
        });
        res.status(201).json({ status: 'success', data: lead });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.createLead = createLead;
const updateLead = async (req, res) => {
    try {
        const pgId = (req.pg?.id || req.params.pgId);
        const leadId = req.params.leadId;
        if (!pgId) {
            return res.status(400).json({ error: 'PG ID context is required.' });
        }
        const validated = updateLeadSchema.parse(req.body);
        const updateData = {};
        if (validated.name !== undefined)
            updateData.name = validated.name;
        if (validated.phone !== undefined)
            updateData.phone = validated.phone;
        if (validated.source !== undefined)
            updateData.source = validated.source;
        if (validated.status !== undefined)
            updateData.status = validated.status;
        if (validated.interestedRoomId !== undefined)
            updateData.interestedRoomId = validated.interestedRoomId;
        if (validated.expectedMoveIn !== undefined) {
            updateData.expectedMoveIn = validated.expectedMoveIn ? new Date(validated.expectedMoveIn) : null;
        }
        const lead = await prisma_1.default.lead.update({
            where: { id: leadId },
            data: updateData,
            include: {
                interestedRoom: {
                    select: { id: true, number: true }
                }
            }
        });
        res.status(200).json({ status: 'success', data: lead });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.updateLead = updateLead;
const deleteLead = async (req, res) => {
    try {
        const leadId = req.params.leadId;
        await prisma_1.default.lead.delete({
            where: { id: leadId }
        });
        res.status(200).json({ status: 'success', message: 'Lead deleted successfully.' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.deleteLead = deleteLead;
//# sourceMappingURL=leadController.js.map