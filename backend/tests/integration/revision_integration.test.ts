import { describe, it, expect, beforeAll } from 'vitest';
import { query, withTransaction } from '@/shared/database/client';
import { RevisionService } from '@/modules/settings/revision.service';
import { BillingService } from '@/modules/billing/billing.service';
import { PurchaseService } from '@/modules/purchases/purchases.service';
import { StockLedgerService } from '@/modules/stock/stock.service';
import { ReconciliationService } from '@/modules/reconciliation/reconciliation.service';
import { RecipeService } from '@/modules/recipe/recipe.service';
import { SettingsService } from '@/modules/settings/settings.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword } from '@/shared/auth/security';

describe('Revision Integration Verification (All 6 Domains)', () => {
  let adminId: string;

  beforeAll(async () => {
    const email = `rev_test_${Date.now()}@koyalkinare.com`;
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await AuthRepository.createAdmin({
      email,
      passwordHash,
      displayName: 'Revision Test Admin',
    });
    adminId = admin.id;
  });

  it('1. should increment revision atomically for settings mutations', async () => {
    const revBefore = await RevisionService.getCurrentRevision('settings');
    await SettingsService.updateBusinessSettings({ cafeName: 'Koyal Kinare Updated' }, adminId);
    const revAfter = await RevisionService.getCurrentRevision('settings');
    expect(revAfter).toBe(revBefore + 1);
  });

  it('2. should increment revision atomically for reconciliation mutations', async () => {
    const revBefore = await RevisionService.getCurrentRevision('reconciliation');
    await ReconciliationService.setOpeningCash('2026-10-08', 500, adminId);
    const revAfter = await RevisionService.getCurrentRevision('reconciliation');
    expect(revAfter).toBe(revBefore + 1);
  });

  it('3. should verify bumpRevision directly increments domain revision atomically in transaction', async () => {
    for (const domain of ['bill', 'purchase', 'stock', 'reconciliation', 'recipe', 'settings'] as const) {
      const before = await RevisionService.getCurrentRevision(domain);
      await withTransaction(async (client) => {
        const bumped = await RevisionService.bumpRevision(domain, client);
        expect(bumped).toBe(before + 1);
      });
      const after = await RevisionService.getCurrentRevision(domain);
      expect(after).toBe(before + 1);
    }
  });

  it('4. should prevent stale mutations via verifyRevision', async () => {
    const current = await RevisionService.getCurrentRevision('bill');
    await expect(
      RevisionService.verifyRevision('bill', current - 1, undefined, adminId)
    ).rejects.toThrow();
  });
});
