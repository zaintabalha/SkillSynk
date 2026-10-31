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
- Optional env: `GEMINI_API_KEY` — enables live Gemini 2.5 Flash matching, room moderation, challenge generation, and project evaluation; deterministic demo behavior is used when unset

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

## Gotchas

- All `/api/skillsync/*` routes require an authenticated Clerk session.
- After changing `lib/api-spec/openapi.yaml`, run API code generation before typechecking packages that consume generated schemas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
