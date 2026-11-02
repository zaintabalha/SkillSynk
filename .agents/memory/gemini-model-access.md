---
name: Gemini model access
description: The model choice and account limitation for SkillSync's Gemini integration
---

The user selected `gemini-3.8-flash` after Google rejected `gemini-2.5-flash` for their newly configured API account as unavailable to new users. Keep the model choice and backend-only credential handling unless the user changes them.

**Why:** The requested 2.5 model could not serve this account, and the user explicitly chose 3.8 rather than silently changing the model.

**How to apply:** Before changing the model again, check current provider access and ask the user. Keep requests stateless when using the Interactions API.
