export * from "./schema";
// The whole schema as one namespace, for consumers that need the table map
// itself rather than individual tables (core's `drizzle(client, { schema })`).
export * as schema from "./schema";
