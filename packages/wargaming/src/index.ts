// Public barrel for `@unicum.gg/wargaming`. The whole SDK is imported from here
// (`import { WargamingClient, Region, ClanRole } from "@unicum.gg/wargaming"`).
// Each surface folder has its own barrel (`./api` → `./api/{wot,wgn}`, etc.), so
// this root stays a thin roll-up. The resource modules have no overlapping
// export names, so the flat `export *` is unambiguous. `sideEffects: false`
// (package.json) lets bundlers tree-shake, so a front-end file that only needs
// `Region` doesn't pull `WargamingClient` (and its transport / rate-limiter /
// `fast-xml-parser` chain) into the bundle.
export * from "./client";
export * from "./region";
export * from "./language";
export * from "./assets-mirror";
export * from "./models-mirror";
export * from "./models-shapes";
export * from "./cdn";
export * from "./api";
export * from "./portal";
export * from "./stronghold";
export * from "./tournaments";
export * from "./source";
export * from "./fields";
export * from "./query";
export * from "./util";
