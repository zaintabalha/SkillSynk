---
name: Gemini model access
description: The model choice and account limitation for SkillSync's Gemini integration
---

The user's current SkillSync direction is `gemini-2.5-flash` through standard `generateContent`. Google previously rejected that model for the configured account as unavailable to new users; do not silently substitute another model.

**Why:** The user explicitly restored the requested 2.5 model and asked to remove demo fallbacks, even though prior provider access failed.

**How to apply:** Keep Gemini credentials server-side and use `gemini-2.5-flash` with `generateContent`. If Google rejects the model, report that limitation rather than silently changing models or returning demo content.
