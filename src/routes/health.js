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
        // 'inactive' is a working state: the app can still read and enable it.
        const healthy = ['active', 'inactive'].includes(ufwStatus.status);
        
        const health = {
            status: healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            responseTime: `${responseTime}ms`,
            ufw: {
                available: healthy,
                status: ufwStatus.status
            }
        };

        if (ufwStatus.error) health.ufw.error = ufwStatus.error;
        
        res.status(healthy ? 200 : 503).json(health);
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
