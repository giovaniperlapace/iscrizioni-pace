import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadRegistrationQr, registrationQrState } from "@/lib/qrcode/registration-qr";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import { renderParticipantQrPng } from "@/lib/qrcode/participant-card";
import { participantQrFilename } from "@/lib/qrcode/filename";

export const runtime = "nodejs";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

// A normal authenticated file response also works without data-URL downloads.
// The session selects the registration; URL parameters cannot select another QR.
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await getCurrentAuthContext(supabase, "partecipante");
    if (!auth) return new Response(null, { status: 401, headers: privateHeaders });

    // Keep the same current-event selection as the personal dashboard, even for
    // users whose additional operational roles can read other registrations.
    const { data: registration, error } = await supabase
      .from("registrations")
      .select("id,events!inner(is_current),participants!inner(auth_user_id,first_name,last_name,public_code)")
      .is("deleted_at", null)
      .eq("events.is_current", true)
      .eq("participants.auth_user_id", auth.user.id)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Personal QR registration read failed");
    const participant = Array.isArray(registration?.participants)
      ? registration.participants[0] : registration?.participants;
    if (!registration || !participant || participant.auth_user_id !== auth.user.id) {
      return new Response(null, { status: 404, headers: privateHeaders });
    }

    const record = await loadRegistrationQr(createSupabaseServiceClient(), registration.id);
    if (registrationQrState(record) !== "active") {
      return new Response(null, { status: 404, headers: privateHeaders });
    }
    const token = decryptQrToken(record?.token_encrypted);
    if (!token) return new Response(null, { status: 404, headers: privateHeaders });

    const png = await renderParticipantQrPng(token, participant);
    const filename = participantQrFilename(`${participant.first_name} ${participant.last_name}`);
    return new Response(new Uint8Array(png), { headers: {
      ...privateHeaders,
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-partecipante.png"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    } });
  } catch {
    return new Response(null, { status: 500, headers: privateHeaders });
  }
}
