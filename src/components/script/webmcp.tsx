"use client";

import { useEffect } from "react";
import { TOOL_DEFS, buildApiPath } from "@/services/mcp/tools";

type ModelCtx = {
  registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => Promise<void>;
  provideContext?: (tools: unknown[]) => Promise<void>;
};

export function WebMcp() {
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const tools = TOOL_DEFS.map(({ name, description, inputSchema, path }) => ({
      name,
      description,
      inputSchema,
      annotations: { readOnlyHint: true },
      execute: async (input: Record<string, unknown>) => {
        const res = await fetch(`/api${buildApiPath(path, input)}`);
        return res.json();
      },
    }));

    const docCtx = (document as unknown as { modelContext?: ModelCtx }).modelContext;
    const navCtx = (navigator as unknown as { modelContext?: ModelCtx }).modelContext;

    // W3C spec: document.modelContext.registerTool()
    if (docCtx?.registerTool) {
      Promise.all(tools.map((t) => docCtx.registerTool!(t, { signal }))).catch(() => {});
    }

    // Older Chrome EPP draft: navigator.modelContext.provideContext()
    if (navCtx?.provideContext) {
      navCtx.provideContext(tools).catch(() => {});
    }

    return () => controller.abort();
  }, []);

  return null;
}
