# Reconciliation API

Express + MongoDB backend for the three-way match workspace.

## Run

Copy `.env.example` to `.env`, provide a reachable MongoDB connection string, then run the root project with `pnpm exec tsx backend/src/server.ts`.

The API is mounted at `/api` and protected routes require `Authorization: Bearer <AUTH_TOKEN>`.

Document extraction is deliberately isolated in `src/services/documentParser.ts`. The upload route validates model output before writing anything to MongoDB, so an unavailable or malformed Gemini response cannot create a partially-shaped document.
