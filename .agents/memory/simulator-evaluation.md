---
name: Simulator evaluation safety
description: Safety boundary and expectations for code simulator attempts.
---

Do not execute learner-submitted code in the API process or ordinary app page. Attempt grading remains transparent, bounded static checks and practice feedback. Optional local JavaScript runs belong only in an isolated, opaque-origin iframe and worker with network access disabled, bounded output, and a strict time limit; this is not a guarantee against browser vulnerabilities.

**Why:** untrusted code can exfiltrate data or hang a session. Isolating it locally keeps learner code out of the backend and app context, while resource limits reduce—but do not eliminate—runtime risk.

**How to apply:** keep saved attempt scores based on task/reference signals and basic structure. If adding a local run action, keep execution inside the restricted iframe/worker, never access app APIs or secrets, and explain the sandbox limits in the UI.
