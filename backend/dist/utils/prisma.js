"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
const pool = new pg_1.Pool({ connectionString });
const adapter = new adapter_pg_1.PrismaPg(pool);
const basePrisma = new client_1.PrismaClient({ adapter });
const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async findMany({ model, args, query }) {
                if (model !== 'EventLog' && model !== 'AuditLog' && model !== 'OnboardingAnalytics') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            },
            async findFirst({ model, args, query }) {
                if (model !== 'EventLog' && model !== 'AuditLog' && model !== 'OnboardingAnalytics') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            },
            async count({ model, args, query }) {
                if (model !== 'EventLog' && model !== 'AuditLog' && model !== 'OnboardingAnalytics') {
                    args.where = { isActive: true, ...args.where };
                }
                return query(args);
            }
        }
    }
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map