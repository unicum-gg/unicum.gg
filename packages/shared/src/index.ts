// Root barrel for `@unicum.gg/shared` — the client-safe, side-effect-free
// foundations and pure domain logic/types extracted from `@unicum.gg/core`, so
// they can be imported anywhere (incl. browser bundles) without dragging the
// server stack (postgres/ioredis/crons). Each folder has its own barrel and
// this root rolls them up; every file is reachable from here. The module
// export names never overlap (checked), so the flat `export *` is unambiguous.
// `env` is the one module with an import-time side effect (env-core
// validation), flagged in package.json `sideEffects`.
export * from "./app-identity";
export * from "./env";
export * from "./search";
export * from "./shop";
export * from "./constants";
export * from "./lib";
export * from "./db";
export * from "./clans";
export * from "./players";
export * from "./twitch";
export * from "./feedback";
export * from "./glossary";
export * from "./wot";
export * from "./finance";
