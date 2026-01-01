import { Router } from 'express';
import * as ufw from '../services/ufw.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/errorHandler.js';
import { validateBody, validateParams, schemas } from '../middleware/validation.js';

const router = Router();

/**
 * GET /api/rules - Get all UFW rules
 */
router.get('/', asyncHandler(async (req, res) => {
    const data = await ufw.getStatus();
    res.json(data);
}));

/**
 * POST /api/rules - Add a new rule
 */
router.post('/', validateBody(schemas.addRule), asyncHandler(async (req, res) => {
    const { port, protocol, type, source } = req.body;

    try {
        await ufw.addRule({ port, protocol, type, source });
        logAudit('ADD_RULE', req, { port, protocol, type, source }, true);
        res.json({ success: true });
    } catch (e) {
        logAudit('ADD_RULE', req, { port, protocol, type, source, error: e.message }, false);
        throw e;
    }
}));

/**
 * DELETE /api/rules/:id - Delete a rule
 */
router.delete('/:id', validateParams(schemas.deleteRule), asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        await ufw.deleteRule(id);
        logAudit('DELETE_RULE', req, { ruleId: id }, true);
        res.json({ success: true });
    } catch (e) {
        logAudit('DELETE_RULE', req, { ruleId: id, error: e.message }, false);
        throw e;
    }
}));

/**
 * POST /api/rules/enable - Enable UFW
 */
router.post('/enable', asyncHandler(async (req, res) => {
    try {
        await ufw.enable();
        logAudit('ENABLE_FIREWALL', req, {}, true);
        res.json({ success: true });
    } catch (e) {
        logAudit('ENABLE_FIREWALL', req, { error: e.message }, false);
        throw e;
    }
}));

/**
 * POST /api/rules/disable - Disable UFW
 */
router.post('/disable', asyncHandler(async (req, res) => {
    try {
        await ufw.disable();
        logAudit('DISABLE_FIREWALL', req, {}, true);
        res.json({ success: true });
    } catch (e) {
        logAudit('DISABLE_FIREWALL', req, { error: e.message }, false);
        throw e;
    }
}));

export default router;
