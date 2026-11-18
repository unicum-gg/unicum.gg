import type { Metadata } from "next";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import Link from "@/components/link";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import LEGAL from "@/constants/legal";
import ROUTES from "@/constants/routes";
import { constructMetadata } from "@/lib/metadata";
import { getTranslation } from "@/lib/translations.server";
import { loadLegalDocument } from "@/services/legal/generated";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";
import { LegalSections } from "./markdown";
import { fillLegal } from "./values";

export enum LegalDocumentId {
  Company = "company",
  Privacy = "privacy",
  Terms = "terms",
}

const DOCUMENT_ROUTES: Record<LegalDocumentId, string> = {
  [LegalDocumentId.Company]: ROUTES.COMPANY,
  [LegalDocumentId.Privacy]: ROUTES.PRIVACY,
  [LegalDocumentId.Terms]: ROUTES.TERMS,
};

/**
 * The frame the three legal documents share, built like a glossary entry: the
 * heading and when the text last changed, then the document one titled panel
 * per section, the two other documents as cards (a reader checking one usually
 * wants another), and a way to ask about any of it.
 */
export async function LegalPage({
  locale,
  current,
}: {
  locale: string;
  current: LegalDocumentId;
}) {
  const [{ t }, documents] = await Promise.all([
    getTranslation("components/legal/page", locale),
    Promise.all(
      Object.values(LegalDocumentId).map(async (id) => ({
        id,
        content: (await loadLegalDocument(locale, id)).content,
      })),
    ),
  ]);
  const content = documents.find((d) => d.id === current)!.content;
  const others = documents.filter((d) => d.id !== current);
  const lastUpdated = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(LEGAL.LAST_UPDATED));

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="max-w-3xl px-4 py-8 sm:py-12">
          <div className="mb-4 text-sm text-fd-muted-foreground">
            {t("eyebrow")}
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
            {fillLegal(content.title)}
          </h1>
          <p className="mt-4 text-lg text-fd-muted-foreground">
            {fillLegal(content.description)}
          </p>
          <p className="mt-4 text-sm text-fd-muted-foreground">
            {t("last-updated", { date: lastUpdated })}
          </p>
        </PanelContent>
      </Panel>

      <LegalSections source={content.body} />

      <PanelSeparator />
      <Panel>
        <PanelHeader>
          <PanelTitle>{t("nav.label")}</PanelTitle>
        </PanelHeader>
        <PanelContent className="px-4 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map(({ id, content: other }) => (
              <Link
                key={id}
                href={DOCUMENT_ROUTES[id]}
                className="group flex flex-col gap-1 rounded-md border border-fd-border p-4 transition-colors hover:border-fd-primary/40 hover:bg-fd-secondary/30"
              >
                <span className="font-medium text-fd-foreground group-hover:text-fd-primary">
                  {fillLegal(other.title)}
                </span>
                <span className="line-clamp-2 text-sm text-fd-muted-foreground">
                  {fillLegal(other.description)}
                </span>
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <PanelSeparator />
      <Panel>
        <PanelContent className="flex flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="font-semibold">{t("question.title")}</h2>
            <p className={styles.mutedDescription}>{t("question.description")}</p>
          </div>
          <a
            href={`mailto:${LEGAL.PUBLISHER.EMAIL}`}
            className={cn(buttonVariants({ variant: "primary" }), "shrink-0 gap-2")}
          >
            <EnvelopeSimpleIcon className="size-4" />
            {LEGAL.PUBLISHER.EMAIL}
          </a>
        </PanelContent>
      </Panel>
    </div>
  );
}

/** The metadata of one document, read from its own frontmatter. */
export async function legalMetadata(
  locale: string,
  id: LegalDocumentId,
): Promise<Metadata> {
  const { content } = await loadLegalDocument(locale, id);
  const title = fillLegal(content.title);
  return constructMetadata({
    locale,
    title,
    description: fillLegal(content.description),
    ogTitle: title,
    canonical: DOCUMENT_ROUTES[id],
  });
}
