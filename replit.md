# SkillSync AI

A peer-to-peer skill-sharing platform where university students teach each other, learn in shared rooms, and build projects with AI guidance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/skillsync-ai run dev` — run the SkillSync AI web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — provisioned PostgreSQL connection
- Auth env: Clerk keys are provisioned by Replit's managed Clerk setup
- Optional env: `GEMINI_API_KEY` — enables live AI matching, explicitly requested room assistance, activity generation, and evaluation; clearly identified demo behavior is used when unset
- Admin env: `SKILLSYNC_ADMIN_USER_IDS` — comma-separated Clerk user IDs authorized to administer the platform. No user can grant themselves access through the UI.
- `pnpm --filter @workspace/api-server test` — tests persisted room interactions and simulation boundaries with isolated fixtures, then removes those fixtures

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/skillsync-ai` — React + Vite application and student experience
- `artifacts/api-server` — Express API, Clerk middleware, and SkillSync routes
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/` — PostgreSQL schema
- `lib/api-client-react` and `lib/api-zod` — generated client hooks and request/response validation

## Architecture decisions

- Clerk owns sign-in; API routes use Clerk's session cookie and profiles are keyed by Clerk user ID.
- The shared PostgreSQL database stores profiles, matches, learning rooms, messages, and evaluations.
- Gemini is accessed only by the server. Keep `GEMINI_API_KEY` in Replit Secrets; never expose it to the browser.
- OpenAPI is the contract source; regenerate client hooks and Zod schemas after contract changes.

## Product

Students create teach/learn profiles, discover complementary peers, open shared learning rooms, follow a joint mini-project curriculum, chat with periodic refresh, request daily challenges, and submit work for technical and communication feedback.

## User preferences

The app should run without a Gemini key; AI-dependent actions have clearly identified deterministic demo behavior until the key is configured.

## Learning Room interaction rules

- The assistant is branded only “SkillSync AI” / “مساعد SkillSync الذكي” in user-facing content. Do not expose provider names or invent a personal assistant name.
- Partner Chat is silent unless a student explicitly uses `@AI` / `@SkillSync` or requests reply verification. Never add unsolicited AI moderation.
- The room uses four full-width switchable tabs: Partner Chat, Shared AI Chat, Activities, and Plan & Evaluation.
- Room AI requests use both profiles, the curriculum, and the complete persisted conversation. Both chat channels and activity attempts are shared with the pair.
- User A/User B simulation is permitted only in clearly marked demo rooms. Real-room sender identity always comes from the authenticated session.
- Demo rooms are shared samples visible to signed-in visitors, not private practice spaces. Avoid entering private information there.
- Administrator unmatching preserves transcripts and makes room interactions read-only.
- English/Arabic layout direction and the Student/Admin portal switcher must be preserved.

## Gotchas

- All `/api/skillsync/*` routes require an authenticated Clerk session.
- After changing `lib/api-spec/openapi.yaml`, run API code generation before typechecking packages that consume generated schemas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
