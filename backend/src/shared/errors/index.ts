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


