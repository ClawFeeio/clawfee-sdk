import type {
  ClawFeeConfig,
  ChargeOptions,
  ChargeResult,
  BalanceResult,
  PaymentLinkResult,
  ChargeCustomOptions,
  ChargeCustomResult,
  ResolvedConfig,
} from './types'

export class ClawFeeError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'ClawFeeError'
  }
}

export class ClawFee {
  private config: ResolvedConfig
  private balanceCache: Map<string, { balance: number; timestamp: number }>

  constructor(config: ClawFeeConfig) {
    if (!config.apiKey) {
      throw new ClawFeeError(
        'MISSING_API_KEY',
        'API key is required. Please set the CLAWFEE_API_KEY environment variable and pass it as the apiKey parameter.'
      )
    }
    if (!config.skillId) {
      throw new ClawFeeError(
        'MISSING_SKILL_ID',
        'Skill ID is required. Please set the CLAWFEE_SKILL_ID environment variable and pass it as the skillId parameter.'
      )
    }

    this.config = {
      apiKey: config.apiKey,
      skillId: config.skillId,
      baseUrl: (config.baseUrl ?? 'https://clawfee.io/api/v1').replace(/\/+$/, ''),
      timeout: config.timeout ?? 10000,
      cache: {
        enabled: config.cache?.enabled ?? true,
        ttl: config.cache?.ttl ?? 30000,
      },
      retry: {
        maxAttempts: config.retry?.maxAttempts ?? 3,
        delay: config.retry?.delay ?? 1000,
      },
    }

    this.balanceCache = new Map()
  }

  /**
   * Charge a user once.
   *
   * Returns charged=true on success, or charged=false with a payment URL when balance is insufficient.
   * Retries on network failure according to config; throws ClawFeeError after max attempts are exhausted.
   */
  async charge(userId: string, options?: ChargeOptions): Promise<ChargeResult> {
    const body: Record<string, string> = {
      user_id: userId,
    }
    if (options?.idempotencyKey) {
      body.idempotency_key = options.idempotencyKey
    }

    const data = await this.request('POST', '/billing/charge', body)

    if (data.success) {
      this.setCache(userId, data.balance)
      return {
        charged: true,
        balance: data.balance,
        chargedAmount: data.charged,
        transactionId: data.transaction_id,
      }
    }

    this.clearCache(userId)
    return {
      charged: false,
      balance: data.balance ?? 0,
      paymentUrl: data.payment_url,
      subscribeUrl: data.subscribe_url,
      reason: data.reason,
      message: data.message ?? 'Insufficient balance. Please top up to continue.',
    }
  }

  /**
   * Get the balance for a user.
   *
   * Returns the cached value if it has not expired; otherwise fetches the latest balance from the server.
   */
  async getBalance(userId: string): Promise<BalanceResult> {
    const cached = this.getCache(userId)
    if (cached !== null) {
      return { balance: cached, userId }
    }

    const data = await this.request('GET', `/billing/balance?user_id=${encodeURIComponent(userId)}`)
    this.setCache(userId, data.balance)

    return { balance: data.balance, userId }
  }

  /**
   * Proactively generate a payment link (no need to attempt a charge first).
   */
  async getPaymentLink(userId: string, amount?: number): Promise<PaymentLinkResult> {
    const body: Record<string, unknown> = { user_id: userId }
    if (amount !== undefined) {
      body.amount = amount
    }

    const data = await this.request('POST', '/billing/payment-link', body)

    return {
      paymentUrl: data.payment_url,
      orderId: data.order_id,
      expiresAt: new Date(data.expires_at),
      amount: data.amount,
    }
  }

  /**
   * Generate a payment order with a custom amount.
   *
   * Returns a payment URL for the user to complete payment.
   * After payment is confirmed, funds are automatically settled to developer earnings.
   */
  async chargeCustom(userId: string, options: ChargeCustomOptions): Promise<ChargeCustomResult> {
    const body: Record<string, unknown> = {
      user_id: userId,
      amount: options.amount,
      ...(options.description ? { description: options.description } : {}),
      ...(options.topupAmount ? { topup_amount: options.topupAmount } : {}),
    }

    const data = await this.request('POST', '/billing/charge-custom', body)

    return {
      orderId: data.orderId,
      paymentUrl: data.paymentUrl,
      amount: data.amount,
      description: data.description ?? '',
    }
  }

  /** Manually invalidate the local balance cache for a specific user. */
  invalidateCache(userId: string): void {
    this.balanceCache.delete(this.getCacheKey(userId))
  }

  // ─── Internal methods ───

  private getCacheKey(userId: string): string {
    return `${this.config.skillId}:${userId}`
  }

  private getCache(userId: string): number | null {
    if (!this.config.cache.enabled) return null
    const key = this.getCacheKey(userId)
    const entry = this.balanceCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > this.config.cache.ttl) {
      this.balanceCache.delete(key)
      return null
    }
    return entry.balance
  }

  private setCache(userId: string, balance: number): void {
    if (!this.config.cache.enabled) return
    this.balanceCache.set(this.getCacheKey(userId), {
      balance,
      timestamp: Date.now(),
    })
  }

  private clearCache(userId: string): void {
    this.balanceCache.delete(this.getCacheKey(userId))
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.config.baseUrl}${path}`
    const { maxAttempts, delay } = this.config.retry

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }

        if (body && method !== 'GET') {
          fetchOptions.body = JSON.stringify(body)
        }

        const response = await fetch(url, fetchOptions)
        clearTimeout(timeoutId)

        const json = (await response.json()) as Record<string, any>

        if (response.status === 401) {
          throw new ClawFeeError(
            'INVALID_API_KEY',
            'Invalid API key. Please verify that the CLAWFEE_API_KEY environment variable is set correctly.',
            401
          )
        }

        if (response.status === 404) {
          throw new ClawFeeError(
            'SKILL_NOT_FOUND',
            'Skill not found or has been disabled. Please verify that CLAWFEE_SKILL_ID is correct.',
            404
          )
        }

        if (response.status === 429) {
          throw new ClawFeeError(
            'RATE_LIMITED',
            'Too many requests. Please try again later.',
            429
          )
        }

        if (!response.ok && response.status !== 200) {
          throw new ClawFeeError(
            json?.error?.code ?? 'API_ERROR',
            json?.error?.message ?? `API request failed (HTTP ${response.status})`,
            response.status
          )
        }

        return json
      } catch (err) {
        if (err instanceof ClawFeeError) {
          // Do not retry on auth or resource errors
          if (err.statusCode === 401 || err.statusCode === 404) {
            throw err
          }
        }

        lastError = err as Error

        if (attempt < maxAttempts) {
          await this.sleep(delay * attempt)
        }
      }
    }

    throw new ClawFeeError(
      'NETWORK_ERROR',
      `Request failed after ${maxAttempts} attempt(s): ${lastError?.message ?? 'unknown error'}. Please check your network connection and baseUrl configuration.`
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}