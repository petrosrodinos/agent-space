import type { NextFunction, Request, Response } from 'express';

/** PROCESS_ROLE=worker serves no HTTP except /health (§14.4 Processes). */
export function workerOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.path.endsWith('/health') || req.path.startsWith('/admin/queues')) return next();
    res.status(404).json({ message: 'Worker process' });
}
