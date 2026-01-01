import { Router } from 'express';
import { getStatus } from '../services/ufw.js';

const router = Router();

/**
 * GET /health - Health check endpoint
 * Returns service status without authentication
 */
router.get('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Check UFW status
        const ufwStatus = await getStatus();
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
