---
name: Simulator evaluation safety
description: Safety boundary and expectations for code simulator attempts.
---

Do not execute learner-submitted code in the API process or ordinary browser page. Use transparent, bounded static checks and label scores as practice feedback rather than proof of correctness.

**Why:** running untrusted code is unsafe, and current simulator activities provide a prompt and reference response rather than isolated tests. Real execution requires a separately designed sandbox with resource limits.

**How to apply:** evaluate task/reference signals and basic structure without `eval` or dynamic code execution. If true test execution is required, first introduce an isolated runtime and explicit test-case contract.
