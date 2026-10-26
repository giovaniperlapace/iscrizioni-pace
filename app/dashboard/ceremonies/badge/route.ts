import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createCampaignBadge } from "@/lib/email/campaign-badge.server";
import { closingBadgeSector } from "@/lib/ceremonies/closing-badges";
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("nominee");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response(null, { status: 400, headers });
  const db = await createSupabaseServerClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return new Response(null, { status: 401, headers });
  const { data, error: readError } = await createSupabaseServiceClient().rpc("get_closing_ceremony_badge", { p_actor: user.id, p_nominee: id });
  if (readError) return new Response(null, { status: readError.code === "42501" ? 403 : 503, headers });
  const sector = closingBadgeSector(data?.badgeCode);
  if (!sector || typeof data?.name !== "string") return new Response(null, { status: 404, headers });
  try {
    const badge = await createCampaignBadge({ firstName: data.name, lastName: "", groupName: "" }, sector.template);
    const file = params.get("format") === "jpg" ? badge.image : badge.pdf;
    return new Response(new Uint8Array(file.content), { headers: { ...headers, "Content-Type": file.contentType,
      "Content-Disposition": `${params.get("format") === "jpg" ? "inline" : "attachment"}; filename="${file.filename}"` } });
  } catch { return new Response(null, { status: 503, headers }); }
}
