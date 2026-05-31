import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const basePrisma = new PrismaClient({ adapter });

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      },
      async findFirst({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        if (
          model !== 'EventLog' && 
          model !== 'AuditLog' && 
          model !== 'OnboardingAnalytics' && 
          model !== 'DamageRecovery' && 
          model !== 'DamageRecoveryItem' &&
          model !== 'DepositLedgerTransaction' &&
          model !== 'RecoveryTransaction' &&
          model !== 'StaffSalaryPayment' &&
          model !== 'CleaningChecklist' &&
          model !== 'MonthlyBusinessSnapshot'
        ) {
          args.where = { isActive: true, ...args.where };
        }
        return query(args);
      }
    }
  }
});

export default prisma;
