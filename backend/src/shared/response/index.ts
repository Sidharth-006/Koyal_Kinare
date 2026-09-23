import { NextResponse } from 'next/server';
import { AppError } from '../errors';
import { logger } from '../logging/logger';
import crypto from 'crypto';

export function successResponse(data: any, status: number = 200, headers: Record<string, string> = {}, requestId?: string) {
  const reqId = requestId || crypto.randomUUID();
  return NextResponse.json(
    { data, requestId: reqId },
    { status, headers }
  );
}

export function errorResponse(error: any, requestId?: string) {
  const reqId = requestId || crypto.randomUUID();

  if (error instanceof AppError) {
    logger.warn({ requestId: reqId, code: error.code, message: error.message }, 'Client error occurred');
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message
        },
        requestId: reqId
      },
      { status: error.statusCode }
    );
  }

  logger.error({ requestId: reqId, err: error }, 'Unhandled server error');

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred.'
      },
      requestId: reqId
    },
    { status: 500 }
  );
}
