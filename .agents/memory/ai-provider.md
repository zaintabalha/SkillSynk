---
name: SkillSync AI provider
description: The configured external AI provider and credential boundary for SkillSync
---

SkillSync AI uses Groq through its OpenAI-compatible Chat Completions API. The credential belongs in server-side `GROQ_API_KEY`; do not add it to browser code or silently switch providers when Groq fails.

**Why:** The user directed SkillSync to switch its AI backend from Gemini to Groq.

**How to apply:** Route chat, activities, learning plans, call assistance, and evaluations through the shared backend AI service. Keep failures actionable and preserve the SkillSync AI brand.
