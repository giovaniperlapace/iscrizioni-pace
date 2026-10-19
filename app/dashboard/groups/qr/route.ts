import { NextResponse, type NextRequest } from "next/server";
import { groupReceptionQr } from "../../capogruppo/qr-gruppo/actions";

const headers = { "Cache-Control": "private, no-store" };

// POST because the first explicit opening may create the stable credential.
// HTTP avoids dashboard navigation when authentication refreshes a cookie.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  // Next may normalize loopback URLs; Host retains the browser's actual origin.
  let sameOrigin = false;
  try {
    const source = new URL(origin ?? "");
    sameOrigin = source.host === (request.headers.get("host") ?? request.nextUrl.host)
      && source.protocol === request.nextUrl.protocol;
  } catch { /* Missing or malformed Origin is not an authorized opening. */ }
  if (!sameOrigin) {
    return NextResponse.json({}, { status: 403, headers });
  }
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({}, { status: 400, headers }); }
  if (!input || typeof input.groupId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.groupId)
    || (input.action !== undefined && input.action !== "get")) {
    return NextResponse.json({}, { status: 400, headers });
  }
  return NextResponse.json(await groupReceptionQr(input.groupId, "get"), { headers });
}
