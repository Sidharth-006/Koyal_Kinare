export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class IdempotencyError extends AppError {
  constructor(message: string = 'Idempotency key payload mismatch') {
    super(message, 'IDEMPOTENCY_KEY_REUSED', 409);
  }
}

export class DuplicateInventoryItemError extends AppError {
  constructor(message: string = 'An active inventory item with the same name already exists.') {
    super(message, 'DUPLICATE_INVENTORY_ITEM', 409);
  }
}

export class ItemHasStockHistoryError extends AppError {
  constructor(message: string = 'Cannot change base unit for an item that has stock movement history.') {
    super(message, 'ITEM_HAS_STOCK_HISTORY', 409);
  }
}

export class ItemInUseError extends AppError {
  constructor(message: string = 'Cannot archive inventory item that is in use by pending purchases or operations.') {
    super(message, 'ITEM_IN_USE', 409);
  }
}

export class DuplicateSupplierError extends AppError {
  constructor(message: string = 'An active supplier with the same name already exists.') {
    super(message, 'DUPLICATE_SUPPLIER', 409);
  }
}

export class InsufficientStockError extends AppError {
  constructor(message: string = 'Insufficient stock to perform this movement.') {
    super(message, 'INSUFFICIENT_STOCK', 400);
  }
}

export class DuplicateOpeningStockError extends AppError {
  constructor(message: string = 'Opening stock has already been recorded for this inventory item.') {
    super(message, 'DUPLICATE_OPENING_STOCK', 409);
  }
}

export class DuplicateMovementError extends AppError {
  constructor(message: string = 'A stock movement for this source reference has already been recorded.') {
    super(message, 'DUPLICATE_MOVEMENT', 409);
  }
}

export class PurchaseAlreadyReceivedError extends AppError {
  constructor(message: string = 'Purchase has already been received.') {
    super(message, 'PURCHASE_ALREADY_RECEIVED', 400);
  }
}

export class PurchaseNotReceivableError extends AppError {
  constructor(message: string = 'Purchase cannot be received in its current status.') {
    super(message, 'PURCHASE_NOT_RECEIVABLE', 400);
  }
}

export class PurchaseNotEditableError extends AppError {
  constructor(message: string = 'Only draft purchases can be edited.') {
    super(message, 'PURCHASE_NOT_EDITABLE', 400);
  }
}

export class PurchaseAlreadyReversedError extends AppError {
  constructor(message: string = 'Purchase has already been reversed.') {
    super(message, 'PURCHASE_ALREADY_REVERSED', 400);
  }
}

export class PurchaseNotReversibleError extends AppError {
  constructor(message: string = 'Only received purchases can be reversed.') {
    super(message, 'PURCHASE_NOT_REVERSIBLE', 400);
  }
}

export class SupplierInactiveError extends AppError {
  constructor(message: string = 'Supplier is inactive or archived.') {
    super(message, 'SUPPLIER_INACTIVE', 400);
  }
}

export class InventoryItemArchivedError extends AppError {
  constructor(message: string = 'Inventory item is archived.') {
    super(message, 'INVENTORY_ITEM_ARCHIVED', 400);
  }
}

export class ItemNotLowStockError extends AppError {
  constructor(message: string = 'Item is not currently in low stock.') {
    super(message, 'ITEM_NOT_LOW_STOCK', 400);
  }
}

export class ReportTooLargeError extends AppError {
  constructor(message: string = 'Requested report date range exceeds maximum allowed range (366 days).') {
    super(message, 'REPORT_TOO_LARGE', 400);
  }
}

export class ExportFailedError extends AppError {
  constructor(message: string = 'Report export generation failed.') {
    super(message, 'EXPORT_FAILED', 500);
  }
}

export class StaffArchivedError extends AppError {
  constructor(message: string = 'Cannot record attendance for an archived staff member.') {
    super(message, 'STAFF_ARCHIVED', 400);
  }
}

export class AttendanceTimeInvalidError extends AppError {
  constructor(message: string = 'Invalid check-in or check-out timestamp.') {
    super(message, 'ATTENDANCE_TIME_INVALID', 400);
  }
}

export class AttendanceConflictError extends AppError {
  constructor(message: string = 'Attendance record was updated by another session. Please refresh.') {
    super(message, 'ATTENDANCE_CONFLICT', 409);
  }
}

export class InvalidAttendanceStatusError extends AppError {
  constructor(message: string = 'Invalid attendance status provided.') {
    super(message, 'INVALID_ATTENDANCE_STATUS', 400);
  }
}

export class MenuItemArchivedError extends AppError {
  constructor(message: string = 'Cannot create or modify recipe for an archived or inactive menu item.') {
    super(message, 'MENU_ITEM_ARCHIVED', 400);
  }
}

export class IngredientArchivedError extends AppError {
  constructor(message: string = 'One or more selected inventory items are archived or inactive.') {
    super(message, 'INGREDIENT_ARCHIVED', 400);
  }
}

export class RecipeVersionNotDraftError extends AppError {
  constructor(message: string = 'Only draft recipe versions can be edited or activated.') {
    super(message, 'RECIPE_VERSION_NOT_DRAFT', 400);
  }
}

export class DuplicateRecipeIngredientError extends AppError {
  constructor(message: string = 'Duplicate inventory item specified in recipe ingredients.') {
    super(message, 'DUPLICATE_RECIPE_INGREDIENT', 409);
  }
}

export class RecipeConflictError extends AppError {
  constructor(message: string = 'Recipe state changed concurrently. Please refresh.') {
    super(message, 'RECIPE_CONFLICT', 409);
  }
}



