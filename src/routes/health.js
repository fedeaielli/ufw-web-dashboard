import { Router } from 'express';
import { getStatus } from '../services/ufw.js';

const router = Router();

// Cache the in-flight promise, not just the result, so concurrent requests
// cannot each spawn a ufw process.
const CACHE_TTL_MS = 5000;
let cached = null; // { at, promise }

const getCachedStatus = () => {
    const now = Date.now();
    if (cached && now - cached.at < CACHE_TTL_MS) return cached.promise;

    const promise = getStatus();
    cached = { at: now, promise };
    promise.catch(() => { cached = null; });
    return promise;
};

/**
 * GET /health - Health check endpoint
 * Returns service status without authentication
 */
router.get('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Check UFW status
        const ufwStatus = await getCachedStatus();
        const responseTime = Date.now() - startTime;
        
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            responseTime: `${responseTime}ms`,
            ufw: {
                available: ufwStatus.status !== 'not_installed',
                status: ufwStatus.status
            }
        };
        
        res.json(health);
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            error: 'Service check failed'
        });
    }
});

export default router;
