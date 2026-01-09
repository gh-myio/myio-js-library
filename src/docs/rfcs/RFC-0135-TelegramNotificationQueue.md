# RFC-0135: Telegram Notification Queue, Priority & Rate Control for ThingsBoard Rule Chains

- **Status**: Draft
- **Authors**: MYIO Platform Team
- **Target Version**: ThingsBoard ≥ 3.6
- **Created**: 2026-01-08
- **Updated**: 2026-01-08

## Summary

This RFC proposes a **queued, priority-aware, rate-limited notification pipeline** for sending Telegram messages from ThingsBoard Rule Chains.

The solution replaces the current **direct `External - REST API Call`** approach with a **managed queue layer**, providing:

- Priority control per **Customer** and **Device Profile**
- Rate limiting (batch size + delay between batches)
- Guaranteed ordering per priority
- Extensive logging and observability
- A **Premium Setup Panel** for configuration and monitoring

This design prevents Telegram API rate limits, improves reliability, and enables fine-grained operational control.

## Motivation

### Current Problems

- Messages are sent **immediately** from Rule Chains
- Telegram API may throttle or drop messages
- No prioritization (critical alarms vs informational)
- No per-customer customization
- No centralized log or delivery visibility
- Difficult to audit or replay failed sends

### Goals

- Introduce a **queue-based dispatch model**
- Allow **priority-based scheduling**
- Provide **rate control per customer**
- Centralize **logs and metrics**
- Offer a **Premium UI** for configuration and monitoring

## Non-Goals

- Replace Telegram integration itself
- Implement a generic message broker (Kafka/RabbitMQ)
- Handle non-notification telemetry

## High-Level Architecture

```
┌─────────────────────────────┐
│ ThingsBoard Rule Chain │
│ │
│ Transformation - Script │
│ (builds Telegram payload) │
└──────────────┬──────────────┘
│
▼
┌─────────────────────────────┐
│ Function Node: Queue Enqueue│
│ │
│ - Normalize payload │
│ - Resolve priority │
│ - Persist queue entry │
│ - Write enqueue log │
└──────────────┬──────────────┘
│
▼
┌─────────────────────────────┐
│ Scheduler / Dispatcher │
│ (Rule Chain or External) │
│ │
│ - Fetch next batch │
│ - Apply rate limits │
│ - Send to Telegram API │
│ - Persist send result │
└──────────────┬──────────────┘
│
▼
┌─────────────────────────────┐
│ External - REST API Call │
│ (Telegram Bot API) │
└─────────────────────────────┘
```

## Input Payload (From Transformation Node)

Example message entering the queue layer:

```json
{
  "msg": {
    "text": "Falta de referência de tensão no medidor do transformador (falta de energia) e gerador ligado. undefined - Test Device"
  },
  "metadata": {
    "deviceType": "default",
    "deviceName": "Test Device",
    "ts": "1767878649180"
  },
  "msgType": "POST_TELEMETRY_REQUEST"
}
```

## Queue Model

Queue Entry Schema:

```json
{
  "queueId": "uuid",
  "customerId": "uuid",
  "deviceId": "uuid",
  "deviceProfile": "3F_MEDIDOR",
  "priority": 1,
  "payload": {
    "text": "..."
  },
  "status": "PENDING",
  "retryCount": 0,
  "createdAt": 1767878649180,
  "lastAttemptAt": null
}
```

Priority Convention:

| Priority | Meaning           |
| -------: | ----------------- |
|        1 | Critical / Alarm  |
|        2 | High              |
|        3 | Medium            |
|        4 | Low / Informative |

Priority Resolution Rules:

Priority is resolved in the following order:

1. Customer override
2. Device Profile default
3. Global fallback

## Rate Limiting & Dispatch Control

Configurable per Customer:

| Setting                 | Example              |
| ----------------------- | -------------------- |
| Messages per batch      | 5                    |
| Delay between batches   | 60 sec               |
| Max retries per message | 3                    |
| Retry backoff           | Linear / Exponential |
| Parallel sends          | Disabled (default)   |

## Storage Strategy

1. Queue Storage

Option A — ThingsBoard Attributes (SERVER_SCOPE)

Pros: Native, no external infra
Cons: Limited querying, not ideal for high volume

Option B — External Database (Recommended)

PostgreSQL / DynamoDB / Redis

Better performance and observability

```
telegram_notification_log
-------------------------
id
queue_id
customer_id
device_id
priority
status (SENT | FAILED | RETRY)
http_status
response_body
created_at
```

## Premium Setup Panel (UI)

Scope: Customer Level
Configuration Tabs:

1. Priority Rules
   - Device Profile → Priority mapping
   - Override per device (optional)
2. Rate Control
   - Messages per batch
   - Delay between batches
   - Retry policy
3. Telegram Setup
   - Bot token (masked)
   - Chat / Group ID
   - Enable / Disable notifications
4. Logs & Monitoring
   - Real-time queue depth
   - Sent / Failed counters
   - Searchable message logs
   - Retry visualization

## Observability & Metrics

Recommended metrics:

- Queue depth by priority
- Messages sent per minute
- Failure rate
- Average dispatch delay
- Telegram API error codes

## Security Considerations

- Bot tokens stored encrypted
- UI access controlled by role
- Logs sanitized (no token exposure)

## Backward Compatibility

- Existing Rule Chains can keep direct Telegram send
- Queue system enabled per customer
- Gradual migration supported

## Future Enhancements

- Multi-channel support (Email, WhatsApp, Webhook)
- SLA-based escalation
- Dead-letter queue
- Message deduplication window
- Scheduled quiet hours per customer

## Conclusion

This RFC introduces a robust, enterprise-grade notification pipeline for ThingsBoard Telegram integrations, enabling:

- Reliability
- Scalability
- Observability
- Customer-level customization

It elevates Telegram notifications from a simple integration to a managed communication system, aligned with MYIO's premium platform vision.Retry visualization
