import type { Metadata } from "next";
import {
  LegalDocumentId,
  LegalPage,
  legalMetadata,
} from "@/components/legal/page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, LegalDocumentId.Company);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  return <LegalPage locale={locale} current={LegalDocumentId.Company} />;
}

// The text only changes with a deploy, so it is prerendered and kept.
export const dynamic = "force-static";
export const revalidate = false;
