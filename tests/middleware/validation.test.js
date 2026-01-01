import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { validateBody, validateParams, schemas } from '../../src/middleware/validation.js';

describe('Validation Middleware', () => {
    describe('validateBody', () => {
        it('should pass validation with valid data', () => {
            const schema = {
                name: {
                    required: true,
                    validate: (v) => typeof v === 'string' && v.length > 0,
                    message: 'Name is required'
                }
            };

            const middleware = validateBody(schema);
            const req = { body: { name: 'test' } };
            const res = {};
            const next = mock.fn();

            middleware(req, res, next);
            assert.equal(next.mock.calls.length, 1);
        });

        it('should fail validation with missing required field', () => {
            const schema = {
                name: {
                    required: true,
                    validate: (v) => typeof v === 'string',
                    message: 'Name is required'
                }
            };

            const middleware = validateBody(schema);
            const req = { body: {} };
            const res = {
                status: mock.fn(() => res),
                json: mock.fn()
            };
            const next = mock.fn();

            middleware(req, res, next);
            
            assert.equal(res.status.mock.calls[0].arguments[0], 400);
            assert.equal(next.mock.calls.length, 0);
        });

        it('should skip validation for optional fields', () => {
            const schema = {
                optional: {
                    required: false,
                    validate: (v) => v === 'test'
                }
            };

            const middleware = validateBody(schema);
            const req = { body: {} };
            const res = {};
            const next = mock.fn();

            middleware(req, res, next);
            assert.equal(next.mock.calls.length, 1);
        });
    });

    describe('schemas', () => {
        it('should have addRule schema', () => {
            assert.ok(schemas.addRule);
            assert.ok(schemas.addRule.port);
            assert.ok(schemas.addRule.type);
        });

        it('should have deleteRule schema', () => {
            assert.ok(schemas.deleteRule);
            assert.ok(schemas.deleteRule.id);
        });
    });
});
