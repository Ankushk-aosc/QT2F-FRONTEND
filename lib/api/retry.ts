export interface RetryOptions {
    retries?: number
    delay?: number
    backoffFactor?: number
    maxDelay?: number
    shouldRetry?: (error: unknown) => boolean
}

/**
 * Generic retry helper with exponential backoff, jitter, and smart 429 rate-limit handling.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        retries = 2,
        delay = 800,
        backoffFactor = 2,
        maxDelay = 8000,
        shouldRetry = (err: unknown) => {
            const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            // Don't retry unrecoverable 401s after token refresh attempt has already given up
            if (msg.includes("unauthorized: invalid or expired token after refresh") || msg.includes("missing or invalid authorization")) {
                return false;
            }
            return true;
        }
    } = options

    let attempt = 0
    let currentDelay = delay

    for (;;) {
        try {
            return await fn()
        } catch (error: unknown) {
            attempt++
            if (attempt > retries || !shouldRetry(error)) {
                throw error
            }

            const errorMsg = error instanceof Error ? error.message : String(error);
            const is429 = errorMsg.includes("429") || errorMsg.toLowerCase().includes("too many requests");

            // For 429s, back off more aggressively
            let waitTime = currentDelay;
            if (is429) {
                waitTime = Math.max(waitTime, 2000) * (1 + Math.random() * 0.3);
            } else {
                waitTime = waitTime * (1 + (Math.random() * 0.2 - 0.1)); // Add +-10% jitter
            }
            waitTime = Math.min(waitTime, maxDelay);

            console.warn(`[Retry] Attempt ${attempt}/${retries} failed (${errorMsg}). Retrying in ${Math.round(waitTime)}ms...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
            currentDelay = Math.min(currentDelay * backoffFactor, maxDelay)
        }
    }
}
