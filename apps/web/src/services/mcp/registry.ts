import APP from "@/constants/app";
import { MCP_NAME } from "./skill";

/**
 * The site's host in reverse-DNS form ("gg.unicum"), derived rather than
 * written so it follows `APP.URL`. The official MCP Registry only lets a
 * publisher use a namespace whose domain it has proven, and this is that form.
 */
const NAMESPACE = new URL(APP.URL).hostname.split(".").reverse().join(".");

/**
 * The server's one identity, shared by the MCP handshake, the server card and
 * the registry entry, so a directory comparing them finds the same server.
 */
export const MCP_SERVER_NAME = `${NAMESPACE}/${MCP_NAME}`;

/**
 * Public half of the Ed25519 key `mcp-publisher login http` signs with. Served
 * at `/.well-known/mcp-registry-auth`, which is how the registry checks that
 * whoever publishes under `gg.unicum/*` controls unicum.gg. The private half
 * never enters the repository.
 */
export const MCP_REGISTRY_PUBLIC_KEY = "+wklKsiRl4uuBG0sVMB/0I/aCyD/9u5SzHNA7hIgtvk=";
