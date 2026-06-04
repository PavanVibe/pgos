"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpensesTimeline = exports.addExpense = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const zod_1 = require("zod");
const createExpenseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).default('Expense'),
    amount: zod_1.z.number().positive(),
    category: zod_1.z.string().min(1),
    incurredAt: zod_1.z.string().optional().transform(val => val ? new Date(val) : new Date()),
    notes: zod_1.z.string().optional(),
    receiptUrl: zod_1.z.string().optional()
});
const addExpense = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const actorId = req.auth?.userId || 'system';
        const payload = createExpenseSchema.parse(req.body);
        const expense = await prisma_1.default.expense.create({
            data: {
                pgId: pgId,
                title: payload.title,
                amount: payload.amount,
                category: payload.category.toUpperCase(),
                incurredAt: payload.incurredAt,
                notes: payload.notes || null,
                receiptUrl: payload.receiptUrl || null,
                createdBy: actorId,
                updatedBy: actorId
            }
        });
        res.status(200).json({ status: 'success', data: expense });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.addExpense = addExpense;
const getExpensesTimeline = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const expenses = await prisma_1.default.expense.findMany({
            where: {
                pgId: pgId,
                isActive: true
            },
            orderBy: {
                incurredAt: 'desc'
            }
        });
        res.status(200).json({ status: 'success', data: expenses });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getExpensesTimeline = getExpensesTimeline;
//# sourceMappingURL=expensesController.js.map