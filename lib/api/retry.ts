export interface RetryOptions {
    retries?: number
    delay?: number
    backoffFactor?: number
    shouldRetry?: (error: unknown) => boolean
}

/**
 * Generic retry helper with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        retries = 3,
        delay = 1000,
        backoffFactor = 2,
        shouldRetry = (err) => true
    } = options

    let attempt = 0
    let currentDelay = delay

    while (true) {
        try {
            return await fn()
        } catch (error) {
            attempt++
            if (attempt > retries || !shouldRetry(error)) {
                throw error
            }

            console.warn(`[Retry] Attempt ${attempt}/${retries} failed. Retrying in ${currentDelay}ms...`, error)
            await new Promise(resolve => setTimeout(resolve, currentDelay))
            currentDelay *= backoffFactor
        }
    }
}
