import { HomePage } from "@/components/home/home-page";

export default async function Page() {
  return <HomePage />;
}

export const dynamic = "force-static";
export const revalidate = 60;
