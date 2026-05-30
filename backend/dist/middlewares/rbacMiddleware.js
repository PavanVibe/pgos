"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditAction = exports.canAccessPG = exports.canAccessOrganization = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const canAccessOrganization = async (req, res, next) => {
    try {
        const clerkOrgId = req.headers['x-org-id'];
        const clerkUserId = req.auth?.userId;
        let org = null;
        if (clerkOrgId) {
            org = await prisma_1.default.organization.findUnique({
                where: { clerkOrgId },
            });
        }
        if (!org && clerkUserId) {
            const staff = await prisma_1.default.staff.findFirst({
                where: { clerkUserId },
                include: { organization: true },
            });
            if (staff)
                org = staff.organization;
        }
        if (!org) {
            org = await prisma_1.default.organization.findFirst();
        }
        if (!org) {
            return res.status(403).json({ error: 'Missing active organization context. Please select or create an organization.' });
        }
        req.organization = org;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.canAccessOrganization = canAccessOrganization;
const canAccessPG = async (req, res, next) => {
    try {
        const { pgId } = req.params;
        const organization = req.organization;
        if (!organization || !pgId)
            return res.status(400).json({ error: 'Invalid request context.' });
        let pg = null;
        if (pgId !== 'demo-pg-id' && pgId !== 'demo-pg-123') {
            pg = await prisma_1.default.pG.findFirst({
                where: { id: pgId, organizationId: organization.id },
            });
        }
        if (!pg && (process.env.NODE_ENV !== 'production' || pgId === 'demo-pg-id' || pgId === 'demo-pg-123')) {
            pg = await prisma_1.default.pG.findFirst({
                where: { organizationId: organization.id },
            });
        }
        if (!pg)
            return res.status(403).json({ error: 'Access denied to this PG.' });
        req.pg = pg;
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.canAccessPG = canAccessPG;
const auditAction = (action, entityType) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        let responseBody;
        res.send = function (body) {
            responseBody = body;
            return originalSend.apply(res, arguments);
        };
        res.on('finish', async () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const actorId = req.auth?.userId || 'system';
                let entityId = (req.params.id || req.params.pgId || 'unknown');
                try {
                    if (responseBody) {
                        const parsed = JSON.parse(responseBody);
                        if (parsed.id)
                            entityId = parsed.id;
                    }
                }
                catch (e) { }
                if (entityId !== 'unknown') {
                    await prisma_1.default.auditLog.create({
                        data: {
                            actorId,
                            action,
                            entityType,
                            entityId,
                            metadata: { url: req.originalUrl, method: req.method },
                        }
                    });
                }
            }
        });
        next();
    };
};
exports.auditAction = auditAction;
//# sourceMappingURL=rbacMiddleware.js.map