import { z } from 'zod';

export const createDraftIngredientSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID format.'),
  quantity: z
    .coerce
    .number()
    .positive('Quantity must be greater than 0.'),
  wastageAllowancePct: z
    .coerce
    .number()
    .min(0, 'Wastage allowance cannot be negative.')
    .max(100, 'Wastage allowance cannot exceed 100%.')
    .optional()
    .default(0),
  note: z.string().max(255, 'Ingredient note cannot exceed 255 characters.').optional().nullable()
});

export const createDraftSchema = z.object({
  ingredients: z
    .array(createDraftIngredientSchema)
    .min(1, 'At least one ingredient is required.'),
  note: z.string().max(500, 'Version note cannot exceed 500 characters.').optional().nullable()
});

export const updateDraftSchema = createDraftSchema;

export const recipeListParamsSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  missingOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  page: z.coerce.number().int().positive().optional().default(1)
});

export const activateVersionSchema = z.object({
  confirm: z.boolean().optional().default(true)
});

export const deactivateVersionSchema = z.object({
  confirm: z.boolean().optional().default(true),
  reason: z
    .string({ required_error: 'Deactivation reason is required.' })
    .trim()
    .min(1, 'Deactivation reason is required.')
    .max(500, 'Deactivation reason cannot exceed 500 characters.')
});
