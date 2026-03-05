# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-client fork of [LibreChat](https://librechat.ai) (v0.8.2), a ChatGPT-style AI chat interface. It is customized by Intra-AI for multiple client deployments (currently `intra-ai` and `contiss`). The codebase is a Node.js/React monorepo deployed via Docker Compose with Traefik.

---

## Development Commands

### Running Locally

```bash
# Start backend (with auto-reload)
npm run backend:dev

# Start frontend dev server (after building packages)
npm run frontend:dev

# Or with bun
npm run b:client:dev
```

### Building

```bash
# Build all shared packages (required before frontend build)
npm run build:packages

# Full frontend production build
npm run frontend

# Build individual packages
npm run build:data-provider
npm run build:data-schemas
```

### Testing

```bash
# Run all tests
npm run test:all

# Run tests for a specific workspace
npm run test:client        # React frontend tests
npm run test:api           # API tests
npm run test:packages:data-provider
npm run test:packages:data-schemas

# Watch mode (from workspace directory)
cd client && npm run test
cd api && npm run test
```

### Linting

```bash
npm run lint
npm run lint:fix
npm run format   # prettier
```

### Deployment (Docker)

```bash
# Start production deployment
docker compose -f deploy-compose.yml up -d
# or: npm run start:deployed

# Stop
docker compose -f deploy-compose.yml down

# Rebuild after code changes
docker compose -f deploy-compose.yml build
docker compose -f deploy-compose.yml up -d
```

### Database Migrations

```bash
npm run migrate:agent-permissions        # migrate agent permissions
npm run migrate:prompt-permissions       # migrate prompt permissions
npm run migrate-security                 # add security fields to users
```

### User Management

```bash
npm run create-user
npm run invite-user
npm run reset-password
npm run bulk-register
```

---

## Architecture

### Monorepo Structure

```
api/                    Node.js/Express backend
client/                 React/Vite frontend
packages/
  data-provider/        Shared TypeScript types, Zod schemas, API client (librechat-data-provider)
  data-schemas/         Mongoose schemas (@librechat/data-schemas)
  api/                  Shared API utilities (@librechat/api)
  client/               Shared React components/theming (@librechat/client)
firecrawl/              Bundled Firecrawl web-scraping service
mcp-servers/            MCP server integrations (e.g. flux-image-gen)
config/                 CLI scripts for user/system management
e2e/                    Playwright end-to-end tests
```

**Build order**: `data-provider` -> `data-schemas` -> `api` -> `packages/client` -> `client` (enforced by Turborepo).

### Backend (`api/`)

- **Entry**: `api/server/index.js`
- **Routes**: `api/server/routes/` — one file per resource (agents, auth, files, roles, users, etc.)
- **Controllers**: `api/server/controllers/`
- **Services**: `api/server/services/` — business logic (Auth, Permissions, MCP, Files, Config, etc.)
- **Models**: `api/models/` — Mongoose models (User, Agent, Conversation, Message, Role, etc.)
- **AI Clients**: `api/app/clients/` — provider-specific wrappers (OpenAI, Anthropic, Ollama) extending `BaseClient`
- **Config**: `librechat.yaml` — runtime configuration (endpoints, interface, balance, registration)

### Frontend (`client/src/`)

- **Entry**: `client/src/main.jsx` → `App.jsx`
- **Routing**: `client/src/routes/`
- **State**: Zustand stores in `client/src/store/`
- **API Layer**: React Query hooks in `client/src/data-provider/` (wraps `packages/data-provider`)
- **Components**: `client/src/components/` — organized by domain (Chat, Agents, SidePanel, Nav, Files, etc.)
- **Hooks**: `client/src/hooks/` — organized by domain
- **Locales**: `client/src/locales/` — i18n JSON files (en, de, and others)

### Permissions & Roles System

Permissions flow through several layers:
- `packages/data-provider/src/permissions.ts` — Zod schemas defining permission fields per type (Agents, Prompts, etc.)
- `packages/data-provider/src/roles.ts` — Default role schemas (ADMIN, USER, etc.)
- `packages/data-schemas/src/schema/role.ts` — Mongoose schema for persisted roles
- `api/server/services/PermissionService.js` — runtime permission checks
- `api/server/routes/roles.js` — admin API for role management
- `client/src/components/SidePanel/Agents/AdminSettings.tsx` — admin UI for role configuration

When adding a new permission: update all four layers in order.

---

## Multi-Client Branch Structure

See `GIT_WORKFLOW_GUIDE.md` for full details. Summary:

| Branch | Purpose |
|--------|---------|
| `base` | Core features and bug fixes (shared across all clients) |
| `client/intra-ai/dev` | Intra-AI testing + client-specific customizations |
| `client/intra-ai/prod` | Intra-AI production |
| `client/contiss/dev` | Contiss testing + customizations |
| `client/contiss/prod` | Contiss production |
| `after-sync-*` | Temporary sync/rebase branches for LibreChat upstream merges |

**Rules:**
- Core features always go to `base` first, then merge into client branches
- Client-specific files (`deploy-compose.yml`, `librechat.yaml`, logos) stay on client branches only — never merge back to `base`
- Never merge client branches into each other; always go through `base`
- When pushing changes to all branches, always `pull` before cherry-picking

### Client-Specific Files (never on `base`)

```
deploy-compose.yml          # Domain and Traefik config
librechat.yaml              # Endpoint and interface config
client/public/assets/logo.svg
```

---

## Key Configuration

- **`librechat.yaml`** — Main runtime config: AI endpoints, interface feature flags, balance/token settings, ToS modals
- **`.env`** — Secrets and environment variables (not in repo; use `.env.example` as template)
- **`deploy-compose.yml`** — Docker Compose for production with MongoDB, MeilisSearch, RAG API, Traefik labels

## Intra-AI Additions (vs upstream LibreChat)

Custom features added on top of LibreChat:
- `client/src/components/Contiss/` — Contiss-specific UI components
- `api/server/routes/admin/` — extended admin endpoints
- Mandatory initial password reset & 2FA setup flow (see `SECURITY_FEATURE_DEPLOYMENT.md`)
- MCP server: `mcp-servers/flux-image-gen/` — Flux image generation via IONOS inference
- Audit logging (`api/models/AuditLog.js`)
- Custom agent share/access permission (`Permissions.SHARE`)
