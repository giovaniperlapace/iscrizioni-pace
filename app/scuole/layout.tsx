import type { Metadata } from "next";
import { requireSchoolBookings } from "@/lib/panels/release.server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  await requireSchoolBookings();
  return children;
}
