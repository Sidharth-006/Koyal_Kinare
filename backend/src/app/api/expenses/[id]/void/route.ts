import { NextRequest } from 'next/server';
import { ExpenseService } from '@/modules/expense/expense.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const expense = await ExpenseService.voidExpense(params.id, body.voidReason, admin.id);
    return successResponse({ expense });
  } catch (err) {
    return errorResponse(err);
  }
}
