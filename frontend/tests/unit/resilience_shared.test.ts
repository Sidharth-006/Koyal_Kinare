import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '../../src/lib/api';

describe('Phase 3 Module 5: Shared Resilience & Idempotency Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('HTTP 409 Conflict Handling', () => {
    it('maps generic CONFLICT to exact DLD copy', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'CONFLICT',
            message: 'Internal version mismatch.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(api.getBillById('bill-123')).rejects.toThrow(
        'This record changed on another device. Refresh to see the latest version.'
      );
    });

    it('maps STALE_REVISION to exact DLD copy', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'STALE_REVISION',
            message: 'Stale revision detected for domain stock.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(
        api.recordStockAdjustment({
          inventoryItemId: 'item-1',
          type: 'MANUAL_INCREASE',
          quantity: 5,
          businessDate: '2026-10-08'
        })
      ).rejects.toThrow('This record changed on another device. Refresh to see the latest version.');
    });

    it('maps ATTENDANCE_CONFLICT to exact DLD copy', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'ATTENDANCE_CONFLICT',
            message: 'Row was updated concurrently.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(
        api.bulkSaveAttendance('2026-10-08', { records: [] })
      ).rejects.toThrow('This record changed on another device. Refresh to see the latest version.');
    });

    it('maps RECIPE_CONFLICT to exact DLD copy', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'RECIPE_CONFLICT',
            message: 'Recipe changed concurrently.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(
        api.activateRecipeVersion('ver-1', { confirm: true })
      ).rejects.toThrow('This record changed on another device. Refresh to see the latest version.');
    });
  });

  describe('HTTP 401 Session Expiry Interception', () => {
    it('maps 401 on protected requests to exact DLD session ended string', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token has been revoked.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(api.me()).rejects.toThrow('Your session has ended. Please sign in again.');
    });

    it('preserves login failure copy on /api/auth/login', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid credentials.'
          }
        })
      });
      globalThis.fetch = fetchMock;

      await expect(
        api.login({ email: 'wrong@cafe.com', password: 'bad' })
      ).rejects.toThrow('Sign-in details are incorrect. Please try again.');
    });
  });

  describe('Critical Mutations Idempotency Header Passage', () => {
    it('voidBill passes Idempotency-Key header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            bill: { id: 'bill-1', status: 'VOIDED', bill_number: 'B-101' }
          }
        })
      });
      globalThis.fetch = fetchMock;

      const testKey = 'void-idem-789';
      await api.voidBill('bill-1', 'Customer canceled', testKey);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Idempotency-Key']).toBe(testKey);
    });

    it('recordStockAdjustment passes Idempotency-Key header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            resultingBalance: 15
          }
        })
      });
      globalThis.fetch = fetchMock;

      const testKey = 'adj-idem-999';
      await api.recordStockAdjustment(
        {
          inventoryItemId: 'item-10',
          type: 'MANUAL_DECREASE',
          quantity: 2,
          businessDate: '2026-10-08',
          reason: 'Spillage'
        },
        testKey
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Idempotency-Key']).toBe(testKey);
    });

    it('recordStockCount passes Idempotency-Key header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            resultingBalance: 20,
            movementCreated: true
          }
        })
      });
      globalThis.fetch = fetchMock;

      const testKey = 'cnt-idem-555';
      await api.recordStockCount(
        {
          inventoryItemId: 'item-10',
          actualQuantity: 20,
          businessDate: '2026-10-08'
        },
        testKey
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Idempotency-Key']).toBe(testKey);
    });
  });
});
