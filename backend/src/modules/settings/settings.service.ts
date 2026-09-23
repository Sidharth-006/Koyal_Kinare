import { SettingsRepository } from './settings.repository';
import { AuditService } from '../audit/audit.service';

export class SettingsService {
  static async getBusinessSettings() {
    return SettingsRepository.getBusinessSettings();
  }

  static async updateBusinessSettings(params: any, adminId: string, requestId?: string) {
    const before = await SettingsRepository.getBusinessSettings();
    const updated = await SettingsRepository.updateBusinessSettings(params, adminId);
    await AuditService.logEvent({
      adminId,
      action: 'SETTINGS_UPDATED',
      entityType: 'BUSINESS_SETTINGS',
      entityId: updated.id,
      requestId,
      beforeState: before,
      afterState: updated
    });
    return updated;
  }

  static async getTargetSettings() {
    return SettingsRepository.getTargetSettings();
  }

  static async updateTargetSettings(dailyTarget: number | string, monthlyTarget: number | string, adminId: string, requestId?: string) {
    const before = await SettingsRepository.getTargetSettings();
    const updated = await SettingsRepository.updateTargetSettings(dailyTarget, monthlyTarget, adminId);
    await AuditService.logEvent({
      adminId,
      action: 'SETTINGS_UPDATED',
      entityType: 'TARGET_SETTINGS',
      entityId: updated.id,
      requestId,
      beforeState: before,
      afterState: updated
    });
    return updated;
  }

  static async getTaxSettings() {
    return SettingsRepository.getTaxSettings();
  }

  static async updateTaxSettings(enabled: boolean, label: string, rate: number | string, isInclusive: boolean, adminId: string, requestId?: string) {
    const before = await SettingsRepository.getTaxSettings();
    const updated = await SettingsRepository.updateTaxSettings(enabled, label, rate, isInclusive, adminId);
    await AuditService.logEvent({
      adminId,
      action: 'SETTINGS_UPDATED',
      entityType: 'TAX_SETTINGS',
      entityId: updated.id,
      requestId,
      beforeState: before,
      afterState: updated
    });
    return updated;
  }
}
