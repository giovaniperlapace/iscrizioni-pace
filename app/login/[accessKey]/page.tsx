import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSitePaused } from "@/lib/site-pause";
import { isStaffLoginPath } from "@/lib/auth/staff-login";
import { StaffLoginPage } from "../staff-login-page";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PrivateLogin({ params, searchParams }: {
  params: Promise<{ accessKey: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { accessKey } = await params;
  if (!isSitePaused() || !isStaffLoginPath(`/login/${accessKey}`)) redirect("/");
  return <StaffLoginPage searchParams={searchParams} />;
}
