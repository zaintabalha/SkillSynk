---
name: SkillSync AI provider
description: The configured external AI provider and credential boundary for SkillSync
---

SkillSync AI uses Groq through its OpenAI-compatible Chat Completions API. The credential belongs in server-side `GROQ_API_KEY`; do not add it to browser code or silently switch providers when Groq fails.

**Why:** The user directed SkillSync to switch its AI backend from Gemini to Groq.

**How to apply:** Route chat, activities, learning plans, call assistance, and evaluations through the shared backend AI service. Keep failures actionable and preserve the SkillSync AI brand.

The connected Groq account does not have access to the previously suggested `llama-3.3-70b-versatile`; the accessible `openai/gpt-oss-20b` model passed live chat and quiz smoke calls. Model access varies by account.

**Why:** A real provider request returned HTTP 404 `model_not_found` for the suggested Llama model even though the credential was accepted.

**How to apply:** Before selecting or changing the Groq model, query the account's `/openai/v1/models` list and smoke-test the chosen model through the shared AI service. Never expose the key.
