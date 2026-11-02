---
name: Gemini model access
description: The model choice and account limitation for SkillSync's Gemini integration
---

The user's current SkillSync direction is `gemini-2.0-flash` through standard `generateContent`.

**Why:** The user explicitly required this model for SkillSync.

**How to apply:** Keep Gemini credentials server-side and use `gemini-2.0-flash` with `generateContent`. Report provider failures rather than silently changing models or returning demo content.
