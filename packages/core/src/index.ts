// Root barrel for `@unicum.gg/core`. Historically empty (consumers reached in
// via subpaths like `@unicum.gg/core/db`); we are moving core toward barrels,
// so this re-exports the light, framework-agnostic shared bits that other
// packages (e.g. `@unicum.gg/sdk`) legitimately need. Keep it side-effect-free:
// only re-export modules that don't open pools/connections on import.
export { APP_IDENTITY } from "./app-identity";
