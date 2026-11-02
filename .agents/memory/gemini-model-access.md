---
name: Gemini model access
description: The model choice and account limitation for SkillSync's Gemini integration
---

The user's current SkillSync direction is `gemini-3.8-flash` through standard `generateContent`, which Google recommended for this account after rejecting `gemini-2.5-flash`.

**Why:** The user authorized the active model for new accounts after Google rejected `gemini-2.5-flash`.

**How to apply:** Keep Gemini credentials server-side and use `gemini-3.8-flash` with `generateContent`. Report provider failures rather than silently changing models or returning demo content.
