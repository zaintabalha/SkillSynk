---
name: AI admission scope
description: Identity and deployment constraints for AI cost protection
---
Charge AI requests to the authenticated caller, including when a demo request simulates another student. Ordinary partner chat must remain available when AI capacity is exhausted.

**Why:** Simulation must not become a way to rotate identities to evade paid-AI safeguards; AI availability should not interrupt collaboration.

**How to apply:** Keep admission after permission checks and the explicit AI invocation gate, but before writes that would be duplicated on retry.

The initial limits are process-local, not a durable or deployment-wide spending quota.

**Why:** This provides bounded requests without introducing a new external service, but separate server processes have separate budgets and restarts reset windows.

**How to apply:** Before scaling to multiple instances or relying on these limits for a hard spending ceiling, move admission to atomic shared storage and introduce a separate durable spending budget.
