"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import { useTheme } from "fumadocs-ui/provider/base";
import { useEffect } from "react";
import "@scalar/api-reference-react/style.css";
import "./scalar-theme.css";

/**
 * Human-facing API reference (the `service-doc` of the API catalog). Renders the
 * Scalar reference from `/api/openapi.json`, themed via `scalar-theme.css` which
 * maps Scalar's variables onto the site's design tokens.
 */
export default function ApiDocsPage() {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Full-screen overlay: lock the body scroll so it can't reveal the site
    // nav/footer behind it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Scalar keeps its own dark-mode toggle in the sidebar footer and applies
    // the mode as a `dark-mode`/`light-mode` class on `<body>`. Mirror it into
    // the site theme (next-themes sets `.dark` on `<html>`) so the design tokens
    // our `--scalar-*` mappings reference follow it. No loop: next-themes
    // touches `<html>`, this observer watches `<body>`.
    const sync = () =>
      setTheme(document.body.classList.contains("dark-mode") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      document.body.style.overflow = previousOverflow;
    };
  }, [setTheme]);

  // Full-screen overlay so the reference stands alone (no site nav/footer),
  // while still living inside the app so it inherits the design tokens from
  // globals.css. `overscroll-none` stops scroll from chaining to the body.
  return (
    <div className="fixed inset-0 z-100 overflow-auto overscroll-none bg-background">
      <ApiReferenceReact
        configuration={{ url: "/api/openapi.json", defaultOpenAllTags: true }}
      />
    </div>
  );
}
