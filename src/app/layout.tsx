import { HomeLayout } from "fumadocs-ui/layouts/home";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { Toaster } from "@/components/ui/sonner";
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
  const layoutProps = await baseOptions();
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <JsonLd data={websiteSchema()} />
        <JsonLd data={organizationSchema()} />
        <Provider>
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
