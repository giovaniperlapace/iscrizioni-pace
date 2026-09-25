import Fixture from "./pending-feedback-fixture";
import ManagerLayout from "@/app/dashboard/manager/layout";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  if (params.section || params.q) await new Promise(resolve => setTimeout(resolve, 4000));
  const fixture = <Fixture section={params.section ?? "dashboard"} manager={params.manager === "1"} />;
  return params.manager === "1" ? <ManagerLayout>{fixture}</ManagerLayout> : fixture;
}
