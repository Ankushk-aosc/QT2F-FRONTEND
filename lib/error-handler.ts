// lib/error-handler.ts
// Fully fixed version - no more empty {} logs!

export interface AppError {
  message: string
  code?: string
  status?: number
  details?: any
}

export class ApplicationError extends Error {
  code: string
  status: number
  details?: any

  constructor(message: string, code: string = 'UNKNOWN_ERROR', status: number = 500, details?: any) {
    super(message)
    this.name = 'ApplicationError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function parseError(error: unknown): AppError {
  // If it's already our custom error
  if (error instanceof ApplicationError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
    }
  }

  // Standard Error (including fetch/network errors)
  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'ERROR',
      status: 500,
      details: {
        name: error.name,
        stack: error.stack,
      },
    }
  }

  // HTTP error object from fetch (like { message, status, data })
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, any>
    return {
      message: 
        err.message || 
        err.detail || 
        err.error || 
        err.statusText || 
        'An API error occurred',
      code: err.code || 'HTTP_ERROR',
      status: err.status || err.statusCode || 500,
      details: err.data || err.response?.data || err,
    }
  }

  // Fallback
  return {
    message: String(error) || 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    status: 500,
    details: null,
  }
}

export function getErrorMessage(error: unknown): string {
  const parsed = parseError(error)
  return parsed.message
}

/**
 * FIXED logError - now shows real content instead of {}
 */
export function logError(context: string, error: unknown): void {
  const parsed = parseError(error)

  // Structured log with forced visibility of all important fields
  console.error(`[${context}] ERROR:`, {
    // Core info
    message: parsed.message,
    code: parsed.code || 'UNKNOWN',
    status: parsed.status || 'N/A',
    details: parsed.details,

    // Extra: if it's a real Error instance, force show hidden props
    ...(error instanceof Error ? {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack ? error.stack.split('\n').slice(0, 8).join('\n') : null,
    } : {}),

    // Raw object for deep inspection
    rawError: error,
  })

  // Optional: also log parsed version separately
  console.log(`[${context}] PARSED:`, parsed)
}