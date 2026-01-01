import { Router } from 'express';
import { getBlockedStats } from '../services/logs.js';
import config from '../config.js';
import { asyncHandler } from '../utils/errorHandler.js';

const router = Router();

/**
 * GET /api/logs - Get blocked connection stats
 */
router.get('/', asyncHandler(async (req, res) => {
    const lines = parseInt(req.query.lines || config.logs.defaultLines, 10);
    const stats = await getBlockedStats(lines);
    res.json({ ...stats, maxLines: config.logs.maxLines, defaultLines: config.logs.defaultLines });
}));

export default router;
