---
name: Simulator evaluation safety
description: Safety boundary and expectations for code simulator attempts.
---

Do not execute learner-submitted code in the API process or ordinary app page. Attempt grading remains transparent, bounded static checks and practice feedback. Interactive local runs belong only in an opaque-origin sandboxed iframe. Permit local DOM, canvas, and inline scripts inside that iframe; block app-page access, network APIs, external resources, workers, forms, popups, and navigation. Keep a strict session lifetime and bounded logs/output. This is not a guarantee against browser vulnerabilities or resource-exhaustion attacks.

**Why:** learners need real local UI and game interaction, but untrusted code must not reach app data or external services. An opaque iframe with restrictive CSP provides that boundary; time and output limits reduce, but do not eliminate, runtime risk.

**How to apply:** keep saved attempt scores based on task/reference signals and basic structure. If adding local execution, use an iframe without `allow-same-origin`, permit DOM/canvas only within the preview, block external requests/resources and navigation, enforce time/output caps, never access app APIs or secrets, and explain the limits in the UI.
