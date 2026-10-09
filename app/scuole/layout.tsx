import { requirePublicPanelBookings } from "@/lib/panels/release.server";

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  await requirePublicPanelBookings();
  return children;
}
