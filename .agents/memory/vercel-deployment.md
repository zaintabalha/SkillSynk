---
name: Vercel deployment boundary
description: Architectural constraints for deploying SkillSync's Vite frontend and Express API on Vercel.
---

Deploy the main SkillSync frontend as static Vite output and expose the Express app through a Vercel serverless function under `/api/*`. Keep the Vercel build targeted to the main frontend and API package rather than recursively building every workspace artifact.

**Why:** Replit's separate artifact services and long-running server model do not map directly to a single Vercel deployment. Serverless functions do not guarantee persistent process memory or completion of fire-and-forget background work.

**How to apply:** Preserve the root `build:vercel` command and `api/[...path].ts` handler when updating deployment configuration. Any long-running or asynchronous AI work should use a durable external queue/storage mechanism before relying on it in Vercel production.
