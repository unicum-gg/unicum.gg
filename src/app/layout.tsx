import { HomeLayout } from "fumadocs-ui/layouts/home";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Figtree } from "next/font/google";
import { BuildBanner } from "@/components/build-banner";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { RatingMetricRoot } from "@/components/rating-metric-root";
import { Toaster } from "@/components/ui/sonner";
import { ratingMetricFromCookie } from "@/constants/rating";
import STORAGE from "@/constants/storage";
import { baseOptions } from "@/lib/layout.shared";
import { constructMetadata } from "@/lib/metadata";
import { organizationSchema, websiteSchema } from "@/lib/schema-org";
import { Provider } from "./provider";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "World of Tanks player & clan stats",
  });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [layoutProps, cookieStore] = await Promise.all([
    baseOptions(),
    cookies(),
  ]);
  // Paint the initial rating metric on <html> from the cookie so CSS rules
  // ([data-rating-metric="..."] [data-rating-row="..."]) match on the very
  // first server render, no flash before hydration.
  const initialRatingMetric = ratingMetricFromCookie(
    cookieStore.get(STORAGE.COOKIES.RATING)?.value,
  );
  return (
    <html
      lang="en"
      data-rating-metric={initialRatingMetric}
      className={`${figtree.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <Provider>
          <RatingMetricRoot />
          <BuildBanner />
          <HomeLayout {...layoutProps}>
            {children}
            <Footer />
          </HomeLayout>
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
