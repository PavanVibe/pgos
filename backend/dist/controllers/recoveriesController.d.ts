import { Request, Response } from 'express';
/**
 * Fetches the detailed damage recoveries ledger list.
 */
export declare const getRecoveriesLedger: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Aggregates statistics for the damage recoveries dashboard widget.
 */
export declare const getDamageRecoveryDashboard: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Transitions dynamic status states (Accepted, Disputed, Waived, Recovered).
 */
export declare const updateRecoveryStatus: (req: Request, res: Response) => Promise<void>;
/**
 * Locks the stay settlement profile permanently.
 */
export declare const lockStaySettlement: (req: Request, res: Response) => Promise<void>;
/**
 * Fetches audit logs for a specific damage recovery entry.
 */
export declare const getRecoveryAuditLogs: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=recoveriesController.d.ts.map