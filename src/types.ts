export interface ClawFeeConfig {
  /** Required. API Key for the Skill (from env CLAWFEE_API_KEY) */
  apiKey: string
  /** Required. Skill ID (from env CLAWFEE_SKILL_ID) */
  skillId: string
  /** Optional. Base URL for the API, defaults to 'https://clawfee.io/api/v1' */
  baseUrl?: string
  /** Optional. Request timeout in milliseconds, defaults to 10000 */
  timeout?: number
  /** Local balance cache configuration */
  cache?: {
    /** Whether to enable local balance cache, defaults to true */
    enabled?: boolean
    /** Cache TTL in milliseconds, defaults to 30000 */
    ttl?: number
  }
  /** Retry configuration */
  retry?: {
    /** Maximum number of retry attempts, defaults to 3 */
    maxAttempts?: number
    /** Retry delay in milliseconds, defaults to 1000 */
    delay?: number
  }
}

export interface ChargeOptions {
  /** Idempotency key to prevent duplicate charges on network retries */
  idempotencyKey?: string
}

export interface ChargeResult {
  /** true = charge succeeded, false = insufficient balance */
  charged: boolean
  /** Current balance (after charge or current value) */
  balance: number
  /** Amount charged (only present when charged=true) */
  chargedAmount?: number
  /** Transaction ID (only present when charged=true) */
  transactionId?: string
  /** Payment URL (only present when charged=false and balance is insufficient) */
  paymentUrl?: string
  /** Subscribe URL (only present when charged=false and reason is subscription_required) */
  subscribeUrl?: string
  /** Failure reason: 'subscription_required' or undefined for balance-insufficient */
  reason?: string
  /** Human-readable message */
  message?: string
}

export interface BalanceResult {
  balance: number
  userId: string
}

export interface PaymentLinkResult {
  paymentUrl: string
  orderId: string
  expiresAt: Date
  amount: number
}

export interface ChargeCustomOptions {
  /** Charge amount in USDT (0.1 ~ 1000) */
  amount: number
  /** Optional description shown on the payment page */
  description?: string
  /** Optional top-up amount if different from charge amount */
  topupAmount?: number
}

export interface ChargeCustomResult {
  /** Payment order ID */
  orderId: string
  /** URL to redirect the user for payment */
  paymentUrl: string
  /** Charge amount in USDT */
  amount: number
  /** Description shown on the payment page */
  description: string
}

export interface ResolvedConfig {
  apiKey: string
  skillId: string
  baseUrl: string
  timeout: number
  cache: { enabled: boolean; ttl: number }
  retry: { maxAttempts: number; delay: number }
}
