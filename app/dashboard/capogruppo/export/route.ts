import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  loadLeaderScope,
  loadLeaderAssignmentRows,
} from "@/lib/groups/leader-data.server";
import { toAssignmentView } from "@/lib/groups/leader-assignments";
import {
  filterLeaderRows,
  leaderCellText,
  leaderPreferences,
  sortLeaderRows,
  toLeaderTableRow,
} from "@/lib/groups/leader-table";
import { LEADER_TABLE_COPY } from "@/lib/groups/leader-table-copy";
import { writeTableWorkbook } from "@/lib/data-quality/workbook";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const locale = await getRequestLocale();
  const copy = LEADER_TABLE_COPY[locale];
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = await getCurrentAuthContext(
      await createSupabaseServerClient(),
      "capogruppo",
    );
    if (!auth || auth.dashboardRole !== "capogruppo")
      return new Response(copy.error, { status: 403, headers });
    const db = createSupabaseServiceClient();
    const eventId = await getCurrentOperationalEventId(db);
    if (!eventId) return new Response(copy.error, { status: 403, headers });
    const { groupRows, rootGroupIds, scopedGroupIds } = await loadLeaderScope(
      db,
      auth.user.id,
      eventId,
    );
    if (!rootGroupIds.length)
      return new Response(copy.error, { status: 403, headers });
    const startsOnRelation = groupRows.find((group) =>
      rootGroupIds.includes(group.id),
    )?.events;
    const startsOn =
      (Array.isArray(startsOnRelation) ? startsOnRelation[0] : startsOnRelation)
        ?.starts_on ?? null;
    const assignments = await loadLeaderAssignmentRows(db, eventId, [
      ...scopedGroupIds,
    ]);
    const rows = assignments.flatMap((row) => {
      const view = toAssignmentView(row, copy, groupRows);
      return view ? [toLeaderTableRow(view)] : [];
    });
    const params = new URL(request.url).searchParams;
    const preferences = leaderPreferences(params);
    const sorted = sortLeaderRows(
      filterLeaderRows(rows, params),
      preferences,
      startsOn,
      locale,
    );
    const buffer = await writeTableWorkbook(
      copy.sheet,
      preferences.columns.map((column) => copy.columns[column]),
      sorted.map((row) =>
        preferences.columns.map((column) =>
          leaderCellText(row, column, startsOn, locale),
        ),
      ),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="partecipanti-gruppo.xlsx"',
      },
    });
  } catch {
    console.error("[capogruppo:export] Export failed");
    return new Response(copy.error, { status: 500, headers });
  }
}
