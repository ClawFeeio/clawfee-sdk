import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClawFee, ClawFeeError } from './client'

function mockFetch(response: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  })
}

describe('ClawFee SDK', () => {
  const defaultConfig = {
    apiKey: 'sk_test_key',
    skillId: 'skill_test_id',
    baseUrl: 'https://test.clawfee.io/api/v1',
    retry: { maxAttempts: 1, delay: 10 },
  }

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('Constructor validation', () => {
    it('throws when apiKey is missing', () => {
      expect(() => new ClawFee({ apiKey: '', skillId: 'test' })).toThrow('API key is required')
    })

    it('throws when skillId is missing', () => {
      expect(() => new ClawFee({ apiKey: 'sk_test', skillId: '' })).toThrow('Skill ID is required')
    })

    it('initializes successfully with valid config', () => {
      const pay = new ClawFee(defaultConfig)
      expect(pay).toBeInstanceOf(ClawFee)
    })
  })

  describe('charge()', () => {
    it('charges successfully', async () => {
      const fetchMock = mockFetch({
        success: true,
        balance: 4.5,
        charged: 0.5,
        transaction_id: 'tx_123',
      })
      globalThis.fetch = fetchMock

      const pay = new ClawFee(defaultConfig)
      const result = await pay.charge('user_001')

      expect(result.charged).toBe(true)
      expect(result.balance).toBe(4.5)
      expect(result.chargedAmount).toBe(0.5)
      expect(result.transactionId).toBe('tx_123')

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, options] = fetchMock.mock.calls[0]
      expect(url).toBe('https://test.clawfee.io/api/v1/billing/charge')
      expect(options.method).toBe('POST')
      expect(options.headers['X-API-Key']).toBe('sk_test_key')
    })

    it('returns paymentUrl when balance is insufficient', async () => {
      globalThis.fetch = mockFetch({
        success: false,
        balance: 0,
        payment_url: 'https://pay.clawfee.io/order/ord_123',
        message: 'insufficient balance',
      })

      const pay = new ClawFee(defaultConfig)
      const result = await pay.charge('user_002')

      expect(result.charged).toBe(false)
      expect(result.balance).toBe(0)
      expect(result.paymentUrl).toBe('https://pay.clawfee.io/order/ord_123')
    })

    it('passes idempotencyKey in request body', async () => {
      const fetchMock = mockFetch({
        success: true,
        balance: 9,
        charged: 1,
        transaction_id: 'tx_456',
      })
      globalThis.fetch = fetchMock

      const pay = new ClawFee(defaultConfig)
      await pay.charge('user_003', { idempotencyKey: 'idem_abc' })

      const body = JSON.parse(fetchMock.mock.calls[0][1].body)
      expect(body.idempotency_key).toBe('idem_abc')
    })

    it('throws ClawFeeError after exhausting retries on network failure', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
      globalThis.fetch = fetchMock

      const pay = new ClawFee({
        ...defaultConfig,
        retry: { maxAttempts: 2, delay: 10 },
      })

      await expect(pay.charge('user_004')).rejects.toThrow(ClawFeeError)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getBalance()', () => {
    it('fetches from server on first request', async () => {
      const fetchMock = mockFetch({ balance: 10, user_id: 'user_005' })
      globalThis.fetch = fetchMock

      const pay = new ClawFee(defaultConfig)
      const result = await pay.getBalance('user_005')

      expect(result.balance).toBe(10)
      expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('does not make network request on cache hit', async () => {
      const fetchMock = mockFetch({ balance: 10, user_id: 'user_006' })
      globalThis.fetch = fetchMock

      const pay = new ClawFee({ ...defaultConfig, cache: { enabled: true, ttl: 60000 } })

      await pay.getBalance('user_006')
      const result2 = await pay.getBalance('user_006')

      expect(result2.balance).toBe(10)
      expect(fetchMock).toHaveBeenCalledOnce()
    })

    it('re-fetches after cache expires', async () => {
      const fetchMock = mockFetch({ balance: 10, user_id: 'user_007' })
      globalThis.fetch = fetchMock

      const pay = new ClawFee({ ...defaultConfig, cache: { enabled: true, ttl: 1 } })

      await pay.getBalance('user_007')

      await new Promise((r) => setTimeout(r, 10))

      await pay.getBalance('user_007')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('always makes network request when cache is disabled', async () => {
      const fetchMock = mockFetch({ balance: 10, user_id: 'user_008' })
      globalThis.fetch = fetchMock

      const pay = new ClawFee({ ...defaultConfig, cache: { enabled: false } })

      await pay.getBalance('user_008')
      await pay.getBalance('user_008')

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getPaymentLink()', () => {
    it('generates a payment link', async () => {
      const fetchMock = mockFetch({
        payment_url: 'https://pay.clawfee.io/order/ord_789',
        order_id: 'ord_789',
        expires_at: '2026-12-31T00:00:00Z',
        amount: 10,
      })
      globalThis.fetch = fetchMock

      const pay = new ClawFee(defaultConfig)
      const result = await pay.getPaymentLink('user_009', 10)

      expect(result.paymentUrl).toBe('https://pay.clawfee.io/order/ord_789')
      expect(result.orderId).toBe('ord_789')
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.amount).toBe(10)
    })
  })

  describe('invalidateCache()', () => {
    it('re-fetches from server after cache is invalidated', async () => {
      const fetchMock = mockFetch({ balance: 10, user_id: 'user_010' })
      globalThis.fetch = fetchMock

      const pay = new ClawFee({ ...defaultConfig, cache: { enabled: true, ttl: 60000 } })

      await pay.getBalance('user_010')
      pay.invalidateCache('user_010')
      await pay.getBalance('user_010')

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('HTTP error handling', () => {
    it('throws INVALID_API_KEY on 401', async () => {
      globalThis.fetch = mockFetch(
        { error: { code: 'INVALID_API_KEY', message: 'bad key' } },
        401
      )

      const pay = new ClawFee(defaultConfig)

      try {
        await pay.charge('user_011')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ClawFeeError)
        expect((err as ClawFeeError).code).toBe('INVALID_API_KEY')
        expect((err as ClawFeeError).statusCode).toBe(401)
      }
    })

    it('throws SKILL_NOT_FOUND on 404', async () => {
      globalThis.fetch = mockFetch(
        { error: { code: 'SKILL_NOT_FOUND', message: 'not found' } },
        404
      )

      const pay = new ClawFee(defaultConfig)

      try {
        await pay.charge('user_012')
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(ClawFeeError)
        expect((err as ClawFeeError).code).toBe('SKILL_NOT_FOUND')
      }
    })
  })
})
