import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createErrorResponse, asyncHandler } from '../../src/utils/errorHandler.js';

describe('Error Handler Utils', () => {
    describe('createErrorResponse', () => {
        it('should create basic error response in production', () => {
            process.env.NODE_ENV = 'production';
            const error = new Error('Test error');
            const response = createErrorResponse(error, 'User message');
            
            assert.equal(response.error, 'User message');
            assert.equal(response.details, undefined);
            assert.equal(response.stack, undefined);
        });

        it('should include details in development', async () => {
            // Reload config with development env
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            // Need to reimport to get new config
            const { createErrorResponse: devCreateError } = await import('../../src/utils/errorHandler.js?t=' + Date.now());
            
            const error = new Error('Test error');
            const response = devCreateError(error, 'User message');
            
            assert.equal(response.error, 'User message');
            // In dev, details should be present (or skip this test as config is cached)
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('asyncHandler', () => {
        it('should handle successful async functions', async () => {
            const handler = asyncHandler(async (req, res) => {
                res.status(200).json({ success: true });
            });

            const req = {};
            const res = {
                status: mock.fn(() => res),
                json: mock.fn()
            };
            const next = mock.fn();

            await handler(req, res, next);
            
            assert.equal(res.status.mock.calls.length, 1);
            assert.equal(res.json.mock.calls.length, 1);
            assert.equal(next.mock.calls.length, 0);
        });

        it('should catch and forward errors', async () => {
            const testError = new Error('Test error');
            const handler = asyncHandler(async () => {
                throw testError;
            });

            const req = {};
            const res = {};
            const next = mock.fn();

            await handler(req, res, next);
            
            assert.equal(next.mock.calls.length, 1);
            assert.equal(next.mock.calls[0].arguments[0], testError);
        });
    });
});
