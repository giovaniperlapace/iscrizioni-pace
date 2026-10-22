import { redirect } from "next/navigation";
import { createCeremonyManagerClient } from "@/lib/ceremonies/access.server";
import { ceremonyContext } from "@/lib/ceremonies/service";
export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) redirect("/dashboard");
  const kind = (await searchParams).kind === "closing" ? "closing" : "opening";
  redirect(`/dashboard/${context.dashboard}?section=cerimonie&kind=${kind}&nav=mini`);
}
