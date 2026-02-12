# WorldMirror Chatbot Frontend

A local-first AI chatbot frontend built with SvelteKit, Fastify, and TypeScript.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development (web UI + server)
pnpm dev

# Run tests
pnpm test

# Run checks system
pnpm check
```

## Architecture

See `WorldMirror/consolidated-blueprint.md` for the full architecture specification.

## Phase 1 Scope

- Monorepo scaffolding with pnpm workspaces and Turbo
- Web UI shell with streaming chat
- Local server with API routes
- Provider abstraction with mock provider
- End-to-end SSE streaming
- Configuration system with Zod validation
- Checks system for feature validation
