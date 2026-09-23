import { MenuRepository } from './menu.repository';
import { AuditService } from '../audit/audit.service';
import { NotFoundError, ValidationError } from '@/shared/errors';

export class MenuService {
  static async seedDefaultsIfNeeded() {
    await MenuRepository.seedInitialCategoriesIfNeeded();
    await MenuRepository.seedInitialTablesIfNeeded();
  }

  static async listCategories(includeArchived = false) {
    await this.seedDefaultsIfNeeded();
    return MenuRepository.listCategories(includeArchived);
  }

  static async createCategory(name: string, displayOrder = 0) {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Category name is required.');
    }
    return MenuRepository.createCategory(name, displayOrder);
  }

  static async archiveCategory(id: string) {
    return MenuRepository.archiveCategory(id);
  }

  static async restoreCategory(id: string) {
    return MenuRepository.restoreCategory(id);
  }

  static async listMenuItems(includeArchived = false) {
    await this.seedDefaultsIfNeeded();
    return MenuRepository.listMenuItems(includeArchived);
  }

  static async createMenuItem(params: { categoryId: string; name: string; sellingPrice: number | string }) {
    if (!params.categoryId || !params.name || params.sellingPrice === undefined) {
      throw new ValidationError('Category, item name, and price are required.');
    }
    return MenuRepository.createMenuItem(params);
  }

  static async updateMenuItemAvailability(id: string, isAvailable: boolean) {
    const item = await MenuRepository.findMenuItemById(id);
    if (!item) throw new NotFoundError('Menu item not found.');
    return MenuRepository.updateMenuItemAvailability(id, isAvailable);
  }

  static async archiveMenuItem(id: string, adminId: string, requestId?: string) {
    const item = await MenuRepository.findMenuItemById(id);
    if (!item) throw new NotFoundError('Menu item not found.');

    const archived = await MenuRepository.archiveMenuItem(id);
    await AuditService.logEvent({
      adminId,
      action: 'MENU_ITEM_ARCHIVED',
      entityType: 'MENU_ITEM',
      entityId: id,
      requestId,
      beforeState: item,
      afterState: archived
    });
    return archived;
  }

  static async restoreMenuItem(id: string, adminId: string, requestId?: string) {
    const item = await MenuRepository.findMenuItemById(id);
    if (!item) throw new NotFoundError('Menu item not found.');

    const restored = await MenuRepository.restoreMenuItem(id);
    await AuditService.logEvent({
      adminId,
      action: 'MENU_ITEM_RESTORED',
      entityType: 'MENU_ITEM',
      entityId: id,
      requestId,
      beforeState: item,
      afterState: restored
    });
    return restored;
  }

  static async listTables() {
    await this.seedDefaultsIfNeeded();
    return MenuRepository.listTables();
  }
}
