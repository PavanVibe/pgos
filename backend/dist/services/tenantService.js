"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTenantByPhone = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const searchTenantByPhone = async (phone) => {
    const cleanPhone = phone.replace(/\s/g, '');
    const tenant = await prisma_1.default.globalTenant.findUnique({
        where: { phone: cleanPhone },
        select: {
            id: true,
            name: true,
            email: true,
            kycDocUrl: true,
            trustScore: true,
            profiles: {
                where: { isActive: true },
                select: {
                    pgId: true,
                    status: true,
                    moveOutDate: true,
                    pg: { select: { name: true } }
                },
                orderBy: { createdAt: 'desc' },
                take: 3
            }
        }
    });
    return tenant;
};
exports.searchTenantByPhone = searchTenantByPhone;
//# sourceMappingURL=tenantService.js.map