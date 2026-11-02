---
name: Gemini model access
description: The model choice and account limitation for SkillSync's Gemini integration
---

The user's current SkillSync direction is `gemini-3.8-flash` through standard `generateContent`, using only `process.env.GEMINI_API_KEY`.

**Why:** The user explicitly identified this as the active model in Google AI Studio.

**How to apply:** Keep credentials server-side; read only `GEMINI_API_KEY` and use `gemini-3.8-flash` with `generateContent`. Report provider failures rather than silently changing models or returning demo content.
