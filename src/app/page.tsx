import { HomePage } from "@/components/home/home-page";

export const revalidate = 60;

export default async function Page() {
  return <HomePage />;
}
