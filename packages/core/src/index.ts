// Root barrel for `@unicum.gg/core`. Core is the SERVER package (db/redis/crons/
// repositories/WG fetching), consumed via subpaths (`@unicum.gg/core/db`, ...).
// The client-safe, side-effect-free bits (env, app identity, constants, pure
// lib, pure domain math/types) live in `@unicum.gg/shared` instead, so nothing
// server ever leaks into a browser bundle. This root stays intentionally empty.
export {};
