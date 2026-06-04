import { Request, Response } from 'express';
export declare const getVacancyImpact: (req: Request, res: Response) => Promise<void>;
export declare const getFollowUps: (req: Request, res: Response) => Promise<void>;
export declare const getCleaningChecklist: (req: Request, res: Response) => Promise<void>;
export declare const toggleCleaningChecklist: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resetCleaningChecklist: (req: Request, res: Response) => Promise<void>;
export declare const getOperationsSummary: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=operationsController.d.ts.map