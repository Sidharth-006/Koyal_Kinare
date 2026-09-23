import { NextRequest } from 'next/server';
import { ExpenseService } from '@/modules/expense/expense.service';
import { requireAdmin } from '@/shared/auth/guard';
import { successResponse, errorResponse } from '@/shared/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const startDate = req.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = req.nextUrl.searchParams.get('endDate') || undefined;
    const category = req.nextUrl.searchParams.get('category') || undefined;
    const paymentMethod = req.nextUrl.searchParams.get('paymentMethod') || undefined;
    const includeVoided = req.nextUrl.searchParams.get('includeVoided') === 'true';

    const expenses = await ExpenseService.listExpenses({ startDate, endDate, category, paymentMethod, includeVoided });
    return successResponse({ expenses });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const expense = await ExpenseService.createExpense(body, admin.id);
    return successResponse({ expense }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
