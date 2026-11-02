---
name: Provider limiter tests
description: Keep rate-limit unit tests from poisoning the shared AI provider limiter.
---

Tests for rate-limit algorithms should instantiate an isolated `AiLimiter` with the production rule values instead of consuming the process-wide provider limiter.

**Why:** The shared provider limiter keeps rolling request counts for a minute; a unit test that fills its quota causes unrelated live integration tests to fail with false 429 responses.

**How to apply:** Use local limiter instances for quota/concurrency assertions. Reserve the shared limiter for actual provider calls and integration tests.
