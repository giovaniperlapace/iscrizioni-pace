import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import { hashQrToken } from "@/lib/qrcode/token";
import { renderQrDataUrl } from "@/lib/qrcode/render";
const reply = (data: unknown, status=200) => Response.json(data, {status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("bookingId");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply({error:"invalid"},400);
  try {
    const db = await createSupabaseServerClient();
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user) return reply({error:"forbidden"},403);
    const event = await db.from("events").select("id").eq("is_current",true).single();
    if (event.error || !event.data) return reply({error:"unavailable"},503);
    // Every read uses session RLS, including the stricter owner/manager QR policy.
    const booking = await db.from("school_bookings").select("id,status").eq("id",id).eq("event_id",event.data.id).single();
    if (booking.error || !booking.data || !["submitted","confirmed"].includes(booking.data.status)) return reply({error:"unavailable"},404);
    const qr = await db.from("school_booking_qr_tokens").select("token_encrypted,token_hash,status,revoked_at,expires_at")
      .eq("booking_id",id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1).maybeSingle();
    if (qr.error || !qr.data || qr.data.status !== "active" || qr.data.revoked_at || (qr.data.expires_at && Date.parse(qr.data.expires_at)<=Date.now())) return reply({error:"unavailable"},404);
    const token = decryptQrToken(qr.data.token_encrypted);
    if (!token || hashQrToken(token)!==qr.data.token_hash) return reply({error:"unavailable"},503);
    return reply({dataUrl:await renderQrDataUrl(token)});
  } catch { return reply({error:"unavailable"},503); }
}
