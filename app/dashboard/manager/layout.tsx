import type { ReactNode } from "react";
import { ButtonProgressProvider } from "@/components/button-progress";

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return <ButtonProgressProvider>{children}</ButtonProgressProvider>;
}
