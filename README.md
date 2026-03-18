# clawfee-sdk

Add billing to your OpenClaw Skill in minutes.

为你的 OpenClaw Skill 快速接入计费能力。

🌐 [https://clawfee.io](https://clawfee.io)

---

## Installation / 安装

```bash
npm install clawfee-sdk
# or
yarn add clawfee-sdk
# or
pnpm add clawfee-sdk
```

---

## Quick Start / 快速开始

### Step 1 — Initialize the client / 初始化客户端

Create a shared client instance once and reuse it across your app.

创建一个共享客户端实例，在整个应用中复用。

```typescript
// lib/pay.ts
import { ClawFee } from 'clawfee-sdk'

export const pay = new ClawFee({
  apiKey: process.env.CLAWFEE_API_KEY!,
  skillId: process.env.CLAWFEE_SKILL_ID!,
})
```

### Step 2 — Charge before running your skill / 执行技能前先扣费

Call `pay.charge(userId)` at the start of each request. If the user's balance is insufficient, return the payment URL instead of running the skill logic.

在每次请求开始时调用 `pay.charge(userId)`。若余额不足，则返回充值链接而非执行技能逻辑。

```typescript
// handler.ts
import { pay } from './lib/pay'

export async function handler(userId: string, input: string) {
  // Charge the user
  const { charged, paymentUrl } = await pay.charge(userId)

  // Insufficient balance — return payment link
  if (!charged) {
    return { success: false, paymentUrl }
  }

  // Charge succeeded — run your skill logic
  const result = await runMySkillLogic(input)
  return { success: true, result }
}
```

### Step 3 — Deploy and go / 部署上线

Set the `CLAWFEE_API_KEY` and `CLAWFEE_SKILL_ID` environment variables, deploy your skill, and you're done. ClawFee handles balance tracking, payment links, and top-up monitoring automatically.

配置好 `CLAWFEE_API_KEY` 与 `CLAWFEE_SKILL_ID` 环境变量后部署即可。ClawFee 自动处理余额追踪、充值链接生成和到账监控。

---

## Full API / 完整 API

### `pay.charge(userId, options?)`

Charge a user once. Returns `charged: true` on success, or `paymentUrl` when balance is insufficient.

对用户扣费一次。成功时返回 `charged: true`，余额不足时返回 `paymentUrl`。

```typescript
const result = await pay.charge('user_123', {
  idempotencyKey: 'req_abc123', // optional — prevents duplicate charges
})

if (result.charged) {
  console.log(`Charged. Balance: ${result.balance}, TxID: ${result.transactionId}`)
} else {
  console.log(`Insufficient balance. Top up: ${result.paymentUrl}`)
}
```

### `pay.getBalance(userId)`

Get the current balance for a user. / 查询用户当前余额。

```typescript
const { balance } = await pay.getBalance('user_123')
console.log(`Balance: ${balance} USDT`)
```

### `pay.getPaymentLink(userId, amount?)`

Proactively generate a payment link. / 主动生成充值链接。

```typescript
const link = await pay.getPaymentLink('user_123', 10)
console.log(`Payment URL: ${link.paymentUrl}`)
console.log(`Expires at: ${link.expiresAt}`)
```

### `pay.invalidateCache(userId)`

Manually invalidate the local balance cache for a user. / 手动清除指定用户的本地余额缓存。

```typescript
pay.invalidateCache('user_123')
```

---

## Configuration / 配置项

```typescript
const pay = new ClawFee({
  apiKey: 'sk_...',             // required
  skillId: 'skill_...',        // required
  baseUrl: 'https://...',      // optional, defaults to https://clawfee.io/api/v1
  timeout: 10000,              // optional, request timeout in ms
  cache: {
    enabled: true,             // enable local balance cache
    ttl: 30000,                // cache TTL in ms
  },
  retry: {
    maxAttempts: 3,            // max retry attempts
    delay: 1000,               // retry delay in ms
  },
})
```

---

## Error Handling / 错误处理

```typescript
import { ClawFee, ClawFeeError } from 'clawfee-sdk'

try {
  const result = await pay.charge('user_123')
} catch (err) {
  if (err instanceof ClawFeeError) {
    console.error(`[${err.code}] ${err.message}`)
    // Common error codes:
    // INVALID_API_KEY   — invalid API Key
    // SKILL_NOT_FOUND   — skill not found or disabled
    // RATE_LIMITED      — too many requests
    // NETWORK_ERROR     — network error after retries
  }
}
```

---

## Requirements / 环境要求

- Node.js 18+ (uses native `fetch`)
- Or install `node-fetch` as a polyfill for older versions / 旧版本 Node 可安装 `node-fetch` 作为 polyfill

---

## License

MIT

---

📖 Full documentation: [https://clawfee.io/docs](https://clawfee.io/docs)
