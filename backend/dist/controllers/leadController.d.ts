import { Request, Response } from 'express';
export declare const getLeads: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createLead: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateLead: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteLead: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=leadController.d.ts.map