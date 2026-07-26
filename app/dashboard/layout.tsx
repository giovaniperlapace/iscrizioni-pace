import { Suspense } from "react";

import { SessionActivity } from "@/app/dashboard/session-activity";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense fallback={null}>
        <SessionActivity />
      </Suspense>
      {children}
    </>
  );
}
