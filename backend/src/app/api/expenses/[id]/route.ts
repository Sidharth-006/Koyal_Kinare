import { NextRequest } from 'next/server';
import { ExpenseService } from '@/modules/expense/expense.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(req);
    const expense = await ExpenseService.getExpenseById(params.id);
    return successResponse({ expense });
  } catch (err) {
    return errorResponse(err);
  }
}
