import type { Metadata } from "next";
import { constructMetadata } from "@/lib/metadata";
import ROUTES from "@/constants/routes";

// The page itself is a Client Component (Scalar), so metadata lives here.
export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "API Docs",
    description:
      "Interactive reference for the unicum.gg public API: player, clan and tank search, leaderboards and live updates across EU, NA and Asia.",
    canonical: ROUTES.DOCS,
  });
}

export default function DocsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
