import { NextResponse } from "next/server";

/**
 * Applies security headers to API responses.
 * Call this on every NextResponse before returning it from a route handler.
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Deny framing (clickjacking protection)
  response.headers.set("X-Frame-Options", "DENY");
  // Block XSS in old browsers
  response.headers.set("X-XSS-Protection", "1; mode=block");
  // Strict referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Content-Security-Policy for API responses (no UI content served here)
  response.headers.set("Content-Security-Policy", "default-src 'none'");
  // Cache control — API responses must not be cached by CDNs
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

/**
 * Validates that an Authorization Bearer token is present.
 * Returns a 401 response if missing, otherwise null.
 */
export function requireAuth(authHeader: string | null): NextResponse | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return withSecurityHeaders(res);
  }
  return null;
}

/**
 * Creates a JSON error response with security headers applied.
 */
export function errorResponse(
  message: string,
  status: number = 500
): NextResponse {
  const res = NextResponse.json({ error: message }, { status });
  return withSecurityHeaders(res);
}

/**
 * Creates a JSON success response with security headers applied.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  const res = NextResponse.json(data, { status });
  return withSecurityHeaders(res);
}
