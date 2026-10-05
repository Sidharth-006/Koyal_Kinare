import { ZodType } from 'zod';
import { RecipeRepository } from './recipe.repository';
import { MenuRepository } from '../menu/menu.repository';
import { InventoryRepository } from '../inventory/inventory.repository';
import { AuditService } from '../audit/audit.service';
import { IdempotencyRepository } from '../audit/idempotency.repository';
import { withTransaction } from '@/shared/database/client';
import {
  createDraftSchema,
  updateDraftSchema,
  recipeListParamsSchema,
  activateVersionSchema,
  deactivateVersionSchema
} from './recipe.schema';
import {
  NotFoundError,
  ValidationError,
  IdempotencyError,
  MenuItemArchivedError,
  IngredientArchivedError,
  RecipeVersionNotDraftError,
  DuplicateRecipeIngredientError,
  RecipeConflictError
} from '@/shared/errors';
import {
  CreateDraftPayload,
  UpdateDraftPayload,
  ActivateVersionPayload,
  DeactivateVersionPayload,
  RecipeListParams,
  RecipeListResultDTO,
  RecipeVersionDetailDTO,
  RecipeIngredientDTO,
  RecipeVersionSummaryDTO,
  MenuItemRecipeResponseDTO,
  RecipeRecord,
  RecipeVersionRecord,
  RecipeIngredientRecord,
  RecipeVersionStatus
} from './recipe.types';

function formatRecipeIngredientDTO(r: RecipeIngredientRecord): RecipeIngredientDTO {
  return {
    id: r.id,
    inventoryItemId: r.inventory_item_id,
    itemName: r.item_name_snapshot,
    unit: r.unit_snapshot,
    quantity: r.quantity,
    wastageAllowancePct: r.wastage_allowance_pct,
    note: r.note
  };
}

function formatRecipeVersionSummaryDTO(v: RecipeVersionRecord): RecipeVersionSummaryDTO {
  return {
    id: v.id,
    versionNumber: v.version_number,
    status: v.status,
    effectiveFrom: v.effective_from,
    supersededAt: v.superseded_at,
    note: v.note,
    createdBy: v.created_by,
    createdAt: v.created_at
  };
}

function formatRecipeVersionDetailDTO(
  v: RecipeVersionRecord,
  ingredients: RecipeIngredientRecord[]
): RecipeVersionDetailDTO {
  return {
    id: v.id,
    recipeId: v.recipe_id,
    versionNumber: v.version_number,
    status: v.status,
    effectiveFrom: v.effective_from,
    supersededAt: v.superseded_at,
    note: v.note,
    createdBy: v.created_by,
    createdAt: v.created_at,
    ingredients: ingredients.map(formatRecipeIngredientDTO)
  };
}

function validatePayload<T>(schema: ZodType<T, any, any>, rawPayload: unknown): T {
  const result = schema.safeParse(rawPayload);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => e.message).join('; ');
    throw new ValidationError(errorMsg);
  }
  return result.data;
}

export class RecipeService {
  /**
   * Retrieves complete recipe details, active version, current draft, and version history for a menu item.
   */
  static async getRecipeForMenuItem(menuItemId: string): Promise<MenuItemRecipeResponseDTO> {
    const menuItem = await MenuRepository.findMenuItemById(menuItemId);
    if (!menuItem) {
      throw new NotFoundError('Menu item not found.');
    }

    const recipe = await RecipeRepository.findRecipeByMenuItemId(menuItemId);
    if (!recipe) {
      return {
        recipe: null,
        activeVersion: null,
        draftVersion: null,
        versions: []
      };
    }

    // 1. Fetch active version if one exists
    let activeVersion: RecipeVersionDetailDTO | null = null;
    if (recipe.active_version_id) {
      const activeRecord = await RecipeRepository.findVersionById(recipe.active_version_id);
      if (activeRecord) {
        const ingredients = await RecipeRepository.listIngredientsByVersionId(activeRecord.id);
        activeVersion = formatRecipeVersionDetailDTO(activeRecord, ingredients);
      }
    }

    // 2. Fetch latest draft version if one exists
    let draftVersion: RecipeVersionDetailDTO | null = null;
    const draftRecord = await RecipeRepository.findLatestDraftVersionByRecipeId(recipe.id);
    if (draftRecord) {
      const ingredients = await RecipeRepository.listIngredientsByVersionId(draftRecord.id);
      draftVersion = formatRecipeVersionDetailDTO(draftRecord, ingredients);
    }

    // 3. Fetch version summary history
    const allVersions = await RecipeRepository.listVersionsByRecipeId(recipe.id);
    const versions: RecipeVersionSummaryDTO[] = allVersions.map(formatRecipeVersionSummaryDTO);

    return {
      recipe: {
        id: recipe.id,
        menuItemId: recipe.menu_item_id,
        status: recipe.status,
        activeVersionId: recipe.active_version_id,
        createdAt: recipe.created_at,
        updatedAt: recipe.updated_at
      },
      activeVersion,
      draftVersion,
      versions
    };
  }

  /**
   * Creates a new draft recipe version for a menu item.
   * Resolves snapshots server-side from inventory items.
   */
  static async createDraft(
    menuItemId: string,
    rawPayload: CreateDraftPayload,
    adminId: string,
    requestId?: string
  ): Promise<RecipeVersionDetailDTO> {
    const payload = validatePayload(createDraftSchema, rawPayload);

    // 1. Check for duplicate ingredient entries in payload
    const itemIds = payload.ingredients.map((i) => i.inventoryItemId);
    const uniqueIds = new Set(itemIds);
    if (uniqueIds.size !== itemIds.length) {
      throw new DuplicateRecipeIngredientError('Duplicate inventory item specified in recipe ingredients.');
    }

    // 2. Validate menu item exists and is NOT archived
    const menuItem = await MenuRepository.findMenuItemById(menuItemId);
    if (!menuItem) {
      throw new NotFoundError('Menu item not found.');
    }
    if (menuItem.is_archived) {
      throw new MenuItemArchivedError('Cannot create or modify recipe for an archived or inactive menu item.');
    }

    // 3. Resolve inventory item snapshots and verify all ingredients are active
    const resolvedIngredients: Array<{
      inventoryItemId: string;
      itemNameSnapshot: string;
      unitSnapshot: string;
      quantity: number;
      wastageAllowancePct: number;
      note?: string | null;
    }> = [];

    for (const line of payload.ingredients) {
      const invItem = await InventoryRepository.findById(line.inventoryItemId);
      if (!invItem || invItem.is_archived) {
        throw new IngredientArchivedError('One or more selected inventory items are archived or inactive.');
      }
      resolvedIngredients.push({
        inventoryItemId: line.inventoryItemId,
        itemNameSnapshot: invItem.name,
        unitSnapshot: invItem.base_unit,
        quantity: line.quantity,
        wastageAllowancePct: line.wastageAllowancePct ?? 0,
        note: line.note || null
      });
    }

    // 4. Atomically persist parent recipe (if absent), create draft version, and insert lines
    return withTransaction(async (client) => {
      let recipe = await RecipeRepository.findRecipeByMenuItemId(menuItemId, client);
      if (!recipe) {
        recipe = await RecipeRepository.createRecipe({ menuItemId, createdBy: adminId }, client);
      }

      const versionNumber = await RecipeRepository.getNextVersionNumber(recipe.id, client);

      const version = await RecipeRepository.createVersion(
        {
          recipeId: recipe.id,
          versionNumber,
          status: 'DRAFT',
          note: payload.note || null,
          createdBy: adminId
        },
        client
      );

      const insertedIngredients = await RecipeRepository.insertIngredients(
        version.id,
        resolvedIngredients,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'RECIPE_VERSION_DRAFT_CREATED',
          entityType: 'RECIPE_VERSION',
          entityId: version.id,
          requestId,
          afterState: {
            versionId: version.id,
            versionNumber: version.version_number,
            ingredientCount: insertedIngredients.length
          },
          metadata: {
            menuItemId,
            recipeId: recipe.id
          }
        },
        client
      );

      return formatRecipeVersionDetailDTO(version, insertedIngredients);
    });
  }

  /**
   * Updates an existing unactivated draft recipe version.
   * Fails if version is not in DRAFT status.
   */
  static async updateDraft(
    versionId: string,
    rawPayload: UpdateDraftPayload,
    adminId: string,
    requestId?: string
  ): Promise<RecipeVersionDetailDTO> {
    const payload = validatePayload(updateDraftSchema, rawPayload);

    // 1. Check duplicate ingredients
    const itemIds = payload.ingredients.map((i) => i.inventoryItemId);
    const uniqueIds = new Set(itemIds);
    if (uniqueIds.size !== itemIds.length) {
      throw new DuplicateRecipeIngredientError('Duplicate inventory item specified in recipe ingredients.');
    }

    // 2. Validate version exists and is in DRAFT status
    const version = await RecipeRepository.findVersionById(versionId);
    if (!version) {
      throw new NotFoundError('Recipe version not found.');
    }
    if (version.status !== 'DRAFT') {
      throw new RecipeVersionNotDraftError('Only draft recipe versions can be edited or activated.');
    }

    // 3. Validate parent recipe and menu item are not archived
    const recipe = await RecipeRepository.findRecipeById(version.recipe_id);
    if (!recipe) {
      throw new NotFoundError('Parent recipe not found.');
    }
    const menuItem = await MenuRepository.findMenuItemById(recipe.menu_item_id);
    if (!menuItem || menuItem.is_archived) {
      throw new MenuItemArchivedError('Cannot create or modify recipe for an archived or inactive menu item.');
    }

    // 4. Resolve snapshots and verify ingredients are active
    const resolvedIngredients: Array<{
      inventoryItemId: string;
      itemNameSnapshot: string;
      unitSnapshot: string;
      quantity: number;
      wastageAllowancePct: number;
      note?: string | null;
    }> = [];

    for (const line of payload.ingredients) {
      const invItem = await InventoryRepository.findById(line.inventoryItemId);
      if (!invItem || invItem.is_archived) {
        throw new IngredientArchivedError('One or more selected inventory items are archived or inactive.');
      }
      resolvedIngredients.push({
        inventoryItemId: line.inventoryItemId,
        itemNameSnapshot: invItem.name,
        unitSnapshot: invItem.base_unit,
        quantity: line.quantity,
        wastageAllowancePct: line.wastageAllowancePct ?? 0,
        note: line.note || null
      });
    }

    // 5. Atomically update note, replace ingredients, and log audit event
    return withTransaction(async (client) => {
      const updatedVersion = await RecipeRepository.updateVersionNote(
        {
          versionId,
          note: payload.note || null
        },
        client
      );

      await RecipeRepository.deleteIngredientsByVersionId(versionId, client);
      const insertedIngredients = await RecipeRepository.insertIngredients(
        versionId,
        resolvedIngredients,
        client
      );

      await AuditService.logEvent(
        {
          adminId,
          action: 'RECIPE_VERSION_UPDATED',
          entityType: 'RECIPE_VERSION',
          entityId: versionId,
          requestId,
          afterState: {
            versionId,
            versionNumber: updatedVersion.version_number,
            ingredientCount: insertedIngredients.length
          },
          metadata: {
            recipeId: version.recipe_id
          }
        },
        client
      );

      return formatRecipeVersionDetailDTO(updatedVersion, insertedIngredients);
    });
  }

  /**
   * Coverage and list query for recipes.
   */
  static async listRecipes(rawParams: RecipeListParams): Promise<RecipeListResultDTO> {
    const params = validatePayload(recipeListParamsSchema, rawParams);
    const pageSize = 20;

    const { items, total } = await RecipeRepository.listCoverage({
      status: params.status,
      missingOnly: params.missingOnly,
      page: params.page,
      pageSize
    });

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      recipes: items,
      pagination: {
        page: params.page,
        pageSize,
        total,
        totalPages
      }
    };
  }

  /**
   * Activates a draft recipe version, atomically superseding any previous active version.
   * Enforces row-level locks, transactional integrity, audit logging, and idempotency.
   */
  static async activateVersion(
    versionId: string,
    rawPayload: ActivateVersionPayload,
    adminId: string,
    idempotencyKey?: string,
    requestId?: string
  ): Promise<RecipeVersionDetailDTO> {
    const payload = validatePayload(activateVersionSchema, rawPayload);

    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const expectedHash = IdempotencyRepository.computeHash({ versionId, ...payload });
        if (cached.request_hash !== expectedHash) {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
        return cached.response_body;
      }
    }

    const nowIso = new Date().toISOString();

    const result = await withTransaction(async (client) => {
      // 2. Lock candidate version row
      const version = await RecipeRepository.lockVersionById(versionId, client);
      if (!version) {
        throw new NotFoundError('Recipe version not found.');
      }
      if (version.status !== 'DRAFT') {
        throw new RecipeVersionNotDraftError('Only draft recipe versions can be activated.');
      }

      // 3. Lock parent recipe row
      const recipe = await RecipeRepository.lockRecipeById(version.recipe_id, client);
      if (!recipe) {
        throw new NotFoundError('Parent recipe not found.');
      }

      // 4. Validate menu item is active
      const menuItem = await MenuRepository.findMenuItemById(recipe.menu_item_id);
      if (!menuItem || menuItem.is_archived) {
        throw new MenuItemArchivedError('Cannot activate recipe for an archived or inactive menu item.');
      }

      // 5. Validate ingredients exist and are not archived
      const ingredients = await RecipeRepository.listIngredientsByVersionId(versionId, client);
      if (ingredients.length === 0) {
        throw new ValidationError('Cannot activate a recipe version without ingredients.');
      }

      for (const ing of ingredients) {
        const invItem = await InventoryRepository.findById(ing.inventory_item_id, client);
        if (!invItem || invItem.is_archived) {
          throw new IngredientArchivedError(
            `Cannot activate recipe because ingredient '${ing.item_name_snapshot}' is archived or inactive.`
          );
        }
      }

      // 6. Atomically supersede previous active version (if one exists)
      const previousActiveVersionId = recipe.active_version_id;
      if (previousActiveVersionId && previousActiveVersionId !== versionId) {
        await RecipeRepository.updateVersionStatus(
          {
            versionId: previousActiveVersionId,
            status: 'SUPERSEDED',
            supersededAt: nowIso
          },
          client
        );
      }

      // 7. Mark target version ACTIVE
      const activatedVersion = await RecipeRepository.updateVersionStatus(
        {
          versionId,
          status: 'ACTIVE',
          effectiveFrom: nowIso
        },
        client
      );

      // 8. Update parent recipe active pointer and status
      await RecipeRepository.updateRecipeActiveVersion(
        {
          recipeId: recipe.id,
          activeVersionId: versionId,
          status: 'ACTIVE'
        },
        client
      );

      const responseDTO = formatRecipeVersionDetailDTO(activatedVersion, ingredients);

      // 9. Write audit log
      await AuditService.logEvent(
        {
          adminId,
          action: 'RECIPE_VERSION_ACTIVATED',
          entityType: 'RECIPE_VERSION',
          entityId: versionId,
          requestId,
          beforeState: {
            previousActiveVersionId
          },
          afterState: {
            activeVersionId: versionId,
            versionNumber: activatedVersion.version_number
          },
          metadata: {
            menuItemId: recipe.menu_item_id,
            recipeId: recipe.id
          }
        },
        client
      );

      // 10. Save idempotency record if key provided
      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ versionId, ...payload }),
          200,
          responseDTO,
          client
        );
      }

      return responseDTO;
    });

    return result;
  }

  /**
   * Deactivates the currently active recipe version for a menu item.
   * Clears active pointer and records reason.
   */
  static async deactivateVersion(
    versionId: string,
    rawPayload: DeactivateVersionPayload,
    adminId: string,
    idempotencyKey?: string,
    requestId?: string
  ): Promise<{ message: string; versionId: string; recipeId: string; status: RecipeVersionStatus }> {
    const payload = validatePayload(deactivateVersionSchema, rawPayload);

    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const cached = await IdempotencyRepository.find(idempotencyKey);
      if (cached) {
        const expectedHash = IdempotencyRepository.computeHash({ versionId, ...payload });
        if (cached.request_hash !== expectedHash) {
          throw new IdempotencyError('Idempotency key payload mismatch.');
        }
        return cached.response_body;
      }
    }

    const nowIso = new Date().toISOString();

    const result = await withTransaction(async (client) => {
      // 2. Lock candidate version row
      const version = await RecipeRepository.lockVersionById(versionId, client);
      if (!version) {
        throw new NotFoundError('Recipe version not found.');
      }
      if (version.status !== 'ACTIVE') {
        throw new RecipeConflictError('Only active recipe versions can be deactivated.');
      }

      // 3. Lock parent recipe row
      const recipe = await RecipeRepository.lockRecipeById(version.recipe_id, client);
      if (!recipe) {
        throw new NotFoundError('Parent recipe not found.');
      }
      if (recipe.active_version_id !== versionId) {
        throw new RecipeConflictError('Specified version is not currently the active version on the recipe.');
      }

      // 4. Mark version INACTIVE and record reason if provided
      await RecipeRepository.updateVersionStatus(
        {
          versionId,
          status: 'INACTIVE',
          supersededAt: nowIso
        },
        client
      );

      if (payload.reason) {
        const updatedNote = version.note
          ? `${version.note} | Deactivated: ${payload.reason}`
          : `Deactivated: ${payload.reason}`;
        await RecipeRepository.updateVersionNote({ versionId, note: updatedNote }, client);
      }

      // 5. Clear active pointer on parent recipe and set status to INACTIVE
      await RecipeRepository.updateRecipeActiveVersion(
        {
          recipeId: recipe.id,
          activeVersionId: null,
          status: 'INACTIVE'
        },
        client
      );

      const responseBody = {
        message: 'Recipe version successfully deactivated.',
        versionId,
        recipeId: recipe.id,
        status: 'INACTIVE' as RecipeVersionStatus
      };

      // 6. Write audit log
      await AuditService.logEvent(
        {
          adminId,
          action: 'RECIPE_VERSION_DEACTIVATED',
          entityType: 'RECIPE_VERSION',
          entityId: versionId,
          requestId,
          beforeState: {
            activeVersionId: versionId
          },
          afterState: {
            activeVersionId: null,
            status: 'INACTIVE'
          },
          metadata: {
            menuItemId: recipe.menu_item_id,
            recipeId: recipe.id,
            reason: payload.reason || null
          }
        },
        client
      );

      // 7. Save idempotency record if key provided
      if (idempotencyKey) {
        await IdempotencyRepository.save(
          idempotencyKey,
          IdempotencyRepository.computeHash({ versionId, ...payload }),
          200,
          responseBody,
          client
        );
      }

      return responseBody;
    });

    return result;
  }
}

