# clawfee-sdk

[![npm version](https://img.shields.io/npm/v/clawfee-sdk)](https://www.npmjs.com/package/clawfee-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

ClawFee billing SDK for AI Skills. Charge users per-call, subscription, or one-time payment in minutes.

为你的 AI Skill 快速接入计费能力，支持按次收费、订阅模式、单次购买三种模式。

[📖 Documentation](https://clawfee.io/docs) · [🌐 Website](https://clawfee.io) · [💬 Issues](https://github.com/ClawFeeio/clawfee-sdk/issues)

---

## Installation

```bash
npm install clawfee-sdk
# or
yarn add clawfee-sdk
# or
pnpm add clawfee-sdk
```

---

## Prerequisites

- **Node.js 18+** (uses native `fetch`)
- A [ClawFee](https://clawfee.io) account with an API Key
- A Skill created in the [ClawFee dashboard](https://clawfee.io/dashboard)

---

## Quick Start

Five lines to add billing to your AI Skill. / 五行代码完成计费接入。

```typescript
import { ClawFee } from 'clawfee-sdk'

const pay = new ClawFee({
  apiKey: process.env.CLAWFEE_API_KEY!,
  skillId: process.env.CLAWFEE_SKILL_ID!,
})

// Before running your AI skill — charge the user first
const result = await pay.charge('user_123')
if (!result.charged) return { paymentUrl: result.paymentUrl }

// Run your skill...
```

---

## Billing Modes

| Mode | Method | Use Case |
|------|--------|----------|
| **Per-call** | `charge()` | High-frequency AI API calls |
| **Subscription** | `charge()` | Monthly quota-based services |
| **One-time** | `chargeCustom()` | Purchases, pay-to-unlock |

The billing mode is configured per-Skill in the dashboard — your code calls the same `charge()` method for both Per-call and Subscription.

计费模式在 Dashboard 中为每个 Skill 单独配置，代码侧无需区分按次与订阅，统一调用 `charge()`。

---

## Per-call Billing

### How it works

Each call to `charge()` deducts a fixed amount from the user's balance. If the balance is insufficient, the charge is declined and a top-up URL is returned. No charge happens until the user tops up and retries.

每次调用扣除固定金额；余额不足时返回充值链接，不会产生扣费。

### Usage

```typescript
const result = await pay.charge('user_123')

if (result.charged) {
  // Success — run your skill
  console.log('Balance remaining:', result.balance)
  console.log('Amount deducted:', result.chargedAmount)
} else {
  // Insufficient balance — send user to top-up page
  // 余额不足，引导用户充值
  return { redirect: result.paymentUrl }
}
```

### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `charged` | `boolean` | `true` if charge succeeded |
| `balance` | `number` | Balance after charge (or current balance if declined) |
| `chargedAmount` | `number \| undefined` | Amount deducted (only when `charged: true`) |
| `transactionId` | `string \| undefined` | Transaction ID (only when `charged: true`) |
| `paymentUrl` | `string \| undefined` | Top-up URL (only when `charged: false`) |
| `message` | `string \| undefined` | Human-readable failure message |

---

## Subscription Billing

### How it works

Users pay a monthly fee to unlock a call quota. `charge()` deducts from that quota each call. If the quota is exhausted, the user needs to top up extra calls; if the user has never subscribed, a subscribe URL is returned.

用户按月订阅获得调用配额，`charge()` 每次消耗一次配额。用户未订阅时返回订阅链接，配额耗尽时返回充值链接。

### Usage

```typescript
const result = await pay.charge('user_123')

if (!result.charged) {
  if (result.reason === 'subscription_required') {
    // User has never subscribed — redirect to subscribe page
    return { redirect: result.subscribeUrl }
  } else {
    // Quota exhausted — redirect to top-up page
    return { redirect: result.paymentUrl }
  }
}

// Charge succeeded — run your skill
```

### Subscription Flow

Developers do not need to call any subscription API. ClawFee handles subscription creation, renewal, and quota reset automatically. Your only job is to call `charge()` and check the result.

开发者无需调用任何订阅接口，ClawFee 自动管理订阅创建、续期和配额重置。

### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `charged` | `boolean` | `true` if quota deduction succeeded |
| `balance` | `number` | Remaining quota calls |
| `chargedAmount` | `number \| undefined` | Calls deducted (only when `charged: true`) |
| `transactionId` | `string \| undefined` | Transaction ID (only when `charged: true`) |
| `reason` | `string \| undefined` | `'subscription_required'` if user is not subscribed |
| `subscribeUrl` | `string \| undefined` | Subscribe URL (only when `reason === 'subscription_required'`) |
| `paymentUrl` | `string \| undefined` | Top-up URL (when quota is exhausted) |
| `message` | `string \| undefined` | Human-readable failure message |

---

## One-time Payment

### How it works

`chargeCustom()` creates a payment order for a developer-specified amount. The user is redirected to pay, and once confirmed, the funds are automatically settled to your developer earnings. No balance pre-check is performed — a payment order is always created.

`chargeCustom()` 以开发者指定金额创建支付订单，用户付款后平台自动结算至开发者收益。不检查余额，始终生成支付订单。

### Usage

```typescript
const result = await pay.chargeCustom('user_123', {
  amount: 9.99,
  description: 'Purchase HD image generation',
})

// Always redirect user to complete payment
return { redirect: result.paymentUrl }
```

### Return Value

| Field | Type | Description |
|-------|------|-------------|
| `orderId` | `string` | Payment order ID |
| `paymentUrl` | `string` | Redirect user here to complete payment |
| `amount` | `number` | Charge amount in USDT |
| `description` | `string` | Description shown on the payment page |

---

## API Reference

### `new ClawFee(config)`

```typescript
import { ClawFee } from 'clawfee-sdk'

const pay = new ClawFee({
  apiKey: process.env.CLAWFEE_API_KEY!,
  skillId: process.env.CLAWFEE_SKILL_ID!,
})
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `apiKey` | `string` | ✅ | — | API Key for your Skill |
| `skillId` | `string` | ✅ | — | Skill ID from the dashboard |
| `baseUrl` | `string` | — | `https://clawfee.io/api/v1` | API base URL |
| `timeout` | `number` | — | `10000` | Request timeout in milliseconds |
| `cache.enabled` | `boolean` | — | `true` | Enable local balance cache |
| `cache.ttl` | `number` | — | `30000` | Cache TTL in milliseconds |
| `retry.maxAttempts` | `number` | — | `3` | Max retry attempts on network failure |
| `retry.delay` | `number` | — | `1000` | Base retry delay in milliseconds (multiplied by attempt number) |

Throws `ClawFeeError('MISSING_API_KEY')` or `ClawFeeError('MISSING_SKILL_ID')` if required fields are absent.

---

### `pay.charge(userId, options?)`

Charge a user for one call. Used for both **Per-call** and **Subscription** billing modes.

```typescript
const result = await pay.charge('user_123', {
  idempotencyKey: `charge_${requestId}`, // optional
})
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | ✅ | User identifier (scoped to this Skill) |
| `options.idempotencyKey` | `string` | — | Prevents duplicate charges on retries; same key within 24 h returns the cached result |

**Returns** — [`ChargeResult`](#typescript)

---

### `pay.chargeCustom(userId, options)`

Create a one-time payment order for a custom amount. Used for **One-time** billing mode.

```typescript
const result = await pay.chargeCustom('user_123', {
  amount: 9.99,
  description: 'Unlock premium feature',
  topupAmount: 10, // optional: actual top-up amount if different from charge amount
})
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` | ✅ | User identifier |
| `options.amount` | `number` | ✅ | Charge amount in USDT |
| `options.description` | `string` | — | Shown on the payment page |
| `options.topupAmount` | `number` | — | Payment order amount (defaults to `amount`) |

**Returns** — [`ChargeCustomResult`](#typescript)

---

### `pay.getBalance(userId)`

Query the user's current balance for this Skill. Returns the cached value if it has not expired.

查询用户在当前 Skill 下的余额，优先返回本地缓存值。

```typescript
const { balance } = await pay.getBalance('user_123')
console.log(`Balance: ${balance} USDT`)
```

---

### `pay.getPaymentLink(userId, amount?)`

Proactively generate a top-up payment link without attempting a charge first.

主动生成充值链接，无需先尝试扣费。

```typescript
const link = await pay.getPaymentLink('user_123', 10)
console.log(`Top-up URL: ${link.paymentUrl}`)
console.log(`Expires at: ${link.expiresAt}`)
```

| Field | Type | Description |
|-------|------|-------------|
| `paymentUrl` | `string` | Top-up URL |
| `orderId` | `string` | Order ID |
| `expiresAt` | `Date` | Link expiration time |
| `amount` | `number` | Top-up amount |

---

### `pay.invalidateCache(userId)`

Manually clear the local balance cache for a user. Useful after an external top-up event.

手动清除用户的本地余额缓存，适用于已知余额发生外部变化的场景。

```typescript
pay.invalidateCache('user_123')
```

---

## Error Handling

```typescript
import { ClawFee, ClawFeeError } from 'clawfee-sdk'

try {
  const result = await pay.charge('user_123')
} catch (err) {
  if (err instanceof ClawFeeError) {
    switch (err.code) {
      case 'INVALID_API_KEY':
        // API Key is invalid or expired — check environment variables
        break
      case 'SKILL_NOT_FOUND':
        // Skill not found or disabled — verify CLAWFEE_SKILL_ID
        break
      case 'RATE_LIMITED':
        // Too many requests — back off and retry
        break
      case 'NETWORK_ERROR':
        // All retry attempts failed — check connectivity
        break
      default:
        console.error(`[${err.code}] ${err.message}`)
    }
  }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_API_KEY` | — | `apiKey` was not provided to constructor |
| `MISSING_SKILL_ID` | — | `skillId` was not provided to constructor |
| `INVALID_API_KEY` | 401 | API Key is invalid or expired |
| `SKILL_NOT_FOUND` | 404 | Skill not found or has been disabled |
| `CUSTOM_CHARGE_DISABLED` | 403 | Skill does not support one-time billing |
| `INVALID_BILLING_MODE` | 400 | Wrong billing method called for this Skill type |
| `RATE_LIMITED` | 429 | Too many requests |
| `NETWORK_ERROR` | — | All retry attempts failed after max attempts |
| `API_ERROR` | 4xx/5xx | Unexpected API error (check `err.message`) |

`ClawFeeError` also exposes `err.statusCode` (HTTP status) and `err.message` (human-readable description).

---

## Idempotency

Pass an `idempotencyKey` to safely retry a request without risk of double-charging. The same key within a 24-hour window always returns the original result.

传入 `idempotencyKey` 可在重试时避免重复扣费。同一 key 在 24 小时内始终返回首次请求的结果。

```typescript
// Use a stable per-request identifier as the key
await pay.charge('user_123', {
  idempotencyKey: `charge_${orderId}`,
})
```

---

## TypeScript

The SDK is written in TypeScript and ships with complete type definitions. All types are exported.

SDK 完整 TypeScript 支持，所有类型均已导出。

```typescript
import {
  ClawFee,
  ClawFeeError,
  ClawFeeConfig,
  ChargeOptions,
  ChargeResult,
  ChargeCustomOptions,
  ChargeCustomResult,
  BalanceResult,
  PaymentLinkResult,
} from 'clawfee-sdk'
```

---

## Requirements

- Node.js 18+ (uses native `fetch`)
- TypeScript 4.5+ *(optional)*
- For older Node.js versions, install [`node-fetch`](https://www.npmjs.com/package/node-fetch) as a polyfill

---

## License

MIT

---

📖 Full documentation: [https://clawfee.io/docs](https://clawfee.io/docs)
