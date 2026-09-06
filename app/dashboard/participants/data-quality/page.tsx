import { redirect } from "next/navigation";
import { qualityAccess } from "@/lib/data-quality/access.server";

export default async function ImportParticipantsPage() {
  const { isAdmin, canWrite } = await qualityAccess();
  redirect(
    `/dashboard/${isAdmin ? "admin" : "manager"}?section=iscritti${canWrite ? "&import=excel" : ""}`,
  );
}
