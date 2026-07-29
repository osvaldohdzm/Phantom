import { NextResponse } from 'next/server';
import { logger } from './logger';

export function handleServerError(error: unknown, contextStr = 'Unhandled server exception') {
  const errorId = `ERR-2026-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log the complete error details
  logger.error(contextStr, {
    error_id: errorId,
    message: errorMsg,
    stack: errorStack,
  });

  const env = process.env.NODE_ENV || 'development';
  const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

  if (env === 'development') {
    // Dev: full explicit error details in response
    return NextResponse.json({
      status: 500,
      message: errorMsg,
      error_id: errorId,
      stack: errorStack,
    }, { status: 500 });
  } else if (logLevel === 'info' || env === 'test') {
    // QA: hidden stack trace, but descriptive error message
    return NextResponse.json({
      status: 500,
      message: `Error en el servidor: ${errorMsg}. Revise los registros del sistema.`,
      error_id: errorId,
    }, { status: 500 });
  } else {
    // Prod: secure generic error JSON
    return NextResponse.json({
      status: 500,
      message: 'Error interno del servidor. Contacte a soporte.',
      error_id: errorId,
    }, { status: 500 });
  }
}
