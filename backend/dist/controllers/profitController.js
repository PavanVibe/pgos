"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfitSummary = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const getProfitSummary = async (req, res) => {
    try {
        const pgId = req.pg?.id || req.params.pgId;
        const monthParam = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
        const yearParam = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
        const startOfMonth = new Date(yearParam, monthParam - 1, 1);
        const endOfMonth = new Date(yearParam, monthParam, 0, 23, 59, 59, 999);
        // 1. Revenue
        // Rent Collected this month
        const rentCollectedSum = await prisma_1.default.rentInvoice.aggregate({
            where: {
                pgTenantId: {
                    in: (await prisma_1.default.pGTenantProfile.findMany({
                        where: { pgId: pgId }
                    })).map(p => p.id)
                },
                type: 'RENT',
                status: 'PAID',
                paidAt: { gte: startOfMonth, lte: endOfMonth },
                isActive: true
            },
            _sum: { amount: true }
        });
        const rentCollected = rentCollectedSum._sum.amount || 0;
        // Deposits Collected this month
        const depositsCollectedSum = await prisma_1.default.rentInvoice.aggregate({
            where: {
                pgTenantId: {
                    in: (await prisma_1.default.pGTenantProfile.findMany({
                        where: { pgId: pgId }
                    })).map(p => p.id)
                },
                type: 'SECURITY_DEPOSIT',
                status: 'PAID',
                paidAt: { gte: startOfMonth, lte: endOfMonth },
                isActive: true
            },
            _sum: { amount: true }
        });
        const depositsCollected = depositsCollectedSum._sum.amount || 0;
        // Damage Recoveries collected this month (via direct CASH or UPI transactions)
        const damageRecoveriesSum = await prisma_1.default.recoveryTransaction.aggregate({
            where: {
                recovery: {
                    pgId: pgId
                },
                paymentMethod: { in: ['UPI', 'CASH'] },
                createdAt: { gte: startOfMonth, lte: endOfMonth }
            },
            _sum: { amount: true }
        });
        const damageRecoveries = damageRecoveriesSum._sum.amount || 0;
        const totalRevenue = rentCollected + depositsCollected + damageRecoveries;
        // 2. Expenses
        // Standard Expenses this month
        const standardExpenses = await prisma_1.default.expense.findMany({
            where: {
                pgId: pgId,
                isActive: true,
                incurredAt: { gte: startOfMonth, lte: endOfMonth }
            }
        });
        // Staff Salary payments this month
        const salaryPayments = await prisma_1.default.staffSalaryPayment.findMany({
            where: {
                staff: {
                    pgId: pgId
                },
                paymentDate: { gte: startOfMonth, lte: endOfMonth }
            }
        });
        const totalSalaryPaid = salaryPayments.reduce((sum, p) => sum + p.amount, 0);
        // Group Expenses by Category
        const expensesByCategory = {
            SALARY: totalSalaryPaid,
            ELECTRICITY: 0,
            WATER: 0,
            INTERNET: 0,
            FOOD: 0,
            MAINTENANCE: 0,
            FURNITURE: 0,
            MISC: 0
        };
        standardExpenses.forEach((exp) => {
            const cat = exp.category.toUpperCase();
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + exp.amount;
        });
        const totalExpenses = Object.values(expensesByCategory).reduce((sum, amt) => sum + amt, 0);
        const profit = totalRevenue - totalExpenses;
        // Compile Top Expenses list sorted by amount desc
        const topExpenses = Object.entries(expensesByCategory)
            .map(([category, amount]) => ({ category, amount }))
            .filter(item => item.amount > 0)
            .sort((a, b) => b.amount - a.amount);
        res.status(200).json({
            status: 'success',
            data: {
                month: monthParam,
                year: yearParam,
                revenue: totalRevenue,
                expenses: totalExpenses,
                profit,
                breakdown: {
                    rentCollected,
                    depositsCollected,
                    damageRecoveries,
                    expensesByCategory,
                    topExpenses
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getProfitSummary = getProfitSummary;
//# sourceMappingURL=profitController.js.map