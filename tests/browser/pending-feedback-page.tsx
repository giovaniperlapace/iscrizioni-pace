import Fixture from "./pending-feedback-fixture";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (params.section || params.q) await new Promise(resolve => setTimeout(resolve, 4000));
  return <Fixture section={params.section ?? "dashboard"} />;
}
