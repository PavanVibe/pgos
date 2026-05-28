import { Request, Response, NextFunction } from 'express';
export declare const canAccessOrganization: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const canAccessPG: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const auditAction: (action: string, entityType: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=rbacMiddleware.d.ts.map