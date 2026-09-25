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


