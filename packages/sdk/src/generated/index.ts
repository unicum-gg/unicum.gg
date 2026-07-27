// Barrel for the generated sources: the fluent client and the OpenAPI schema
// types. Both files are 100% machine output (`pnpm --filter @unicum.gg/sdk
// generate`). Intra-package code imports `./client` / `./schema` directly to
// avoid an index → client → runtime → schema cycle; this barrel is for the
// package entry point.
export * from "./client";
export * from "./schema";
