import { redirect } from "next/navigation";

// Retired training URL: old bookmarks return to the operational dashboard.
export default function RetiredForumReceptionDemoPage() {
  redirect("/dashboard/accoglienza-forum-eventi");
}
