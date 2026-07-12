import { redirect } from "next/navigation";

export default async function ManagerEmailPage() {
  redirect("/dashboard/manager?section=email");
}
