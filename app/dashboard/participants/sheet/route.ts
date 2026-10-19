import { NextResponse, type NextRequest } from "next/server";
import { getOperationalAccessibility, getOperationalAssociation, getOperationalDemographics } from "../../operational-registration-actions";
import { participantLabelCommand, participantReceptionCommand } from "../reception-actions";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Reuse the canonical authenticated/scope-checked reads. This endpoint never
// accepts a mutation command, even if extra query parameters are supplied.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const id = query.get("registrationId") ?? "";
  if (!uuid.test(id)) return NextResponse.json({}, { status: 400, headers });
  try {
    let result;
    switch (query.get("kind")) {
      case "demographics": result = await getOperationalDemographics(id); break;
      case "association": result = await getOperationalAssociation(id); break;
      case "accessibility": result = await getOperationalAccessibility(id); break;
      case "labels": result = await participantLabelCommand(id, { action: "read", registrationId: id }); break;
      case "reception": {
        const eventId = query.get("eventId") ?? "";
        const code = query.get("code") ?? "";
        if (!uuid.test(eventId) || !code || code.length > 100) return NextResponse.json({}, { status: 400, headers });
        result = await participantReceptionCommand(eventId, id, { action: "inspect", duty: "event_entry", lookup: { kind: "code", value: code } });
        break;
      }
      default: return NextResponse.json({}, { status: 400, headers });
    }
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({}, { status: 500, headers });
  }
}
