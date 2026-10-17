import type { AttendanceSnapshot } from "./attendance.server.ts";
import { subscribeEventAttendanceChanges } from "./attendance-events.ts";

export const ATTENDANCE_RECONCILE_MS = 15 * 60 * 1000;
const resumeAfterMs = 60 * 1000;
type State = { data: AttendanceSnapshot | null; error: boolean; refreshing: boolean };
const empty: State = { data: null, error: false, refreshing: false };

// Scoped to the mounted provider, never cached across sessions or on the server.
// Consumers subscribe to their own timestamp rather than the whole snapshot.
export class EventAttendanceStore {
  readonly eventId: string | null;
  readonly summaryOnly: boolean;
  private state = empty;
  private listeners = new Set<() => void>();
  private active = false;
  private blocked = false;
  private dirty = false;
  private revision = 0;
  private lastRead = 0;
  private request: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(eventId: string | null, summaryOnly = false) {
    this.eventId = eventId;
    this.summaryOnly = summaryOnly;
  }
  snapshot = () => this.state;
  serverSnapshot = () => empty;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(state: State) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  refresh = () => { this.blocked = false; void this.read(); };
  private changed = () => {
    this.dirty = true;
    this.revision++;
    void this.read();
  };
  private resume = () => {
    if (this.dirty || !this.lastRead || Date.now() - this.lastRead >= resumeAfterMs) void this.read();
  };
  private online = () => { void this.read(); };

  start() {
    this.active = true;
    void this.read();
    const unsubscribe = this.summaryOnly ? () => {} : subscribeEventAttendanceChanges(this.changed);
    if (!this.summaryOnly) {
      document.addEventListener("visibilitychange", this.resume);
      window.addEventListener("focus", this.resume);
      window.addEventListener("online", this.online);
    }
    return () => {
      this.active = false;
      this.request?.abort();
      this.request = null;
      clearTimeout(this.timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", this.resume);
      window.removeEventListener("focus", this.resume);
      window.removeEventListener("online", this.online);
    };
  }

  private async read() {
    if (!this.active || !this.eventId || (!this.summaryOnly && document.hidden) || this.blocked || this.request) return;
    clearTimeout(this.timer);
    const request = new AbortController();
    this.request = request;
    const revision = this.revision;
    const timeout = setTimeout(() => request.abort(), 15000);
    this.update({ ...this.state, refreshing: true });
    try {
      const response = await fetch(`/dashboard/attendance?eventId=${encodeURIComponent(this.eventId)}${this.summaryOnly ? "&summary=1" : ""}`, { cache: "no-store", signal: request.signal });
      if (!this.active || this.request !== request) return;
      if (response.redirected || response.status === 401 || response.status === 403) this.blocked = true;
      if (response.redirected || !response.ok) throw new Error("unavailable");
      const data: AttendanceSnapshot = await response.json();
      if (!this.active || this.request !== request) return;
      if (data.eventId !== this.eventId || !data.entries || !data.schoolEntries || !data.totals || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error("invalid");
      // A write during this read needs one subsequent read. Its older response
      // must not overwrite the presence just confirmed by the operator.
      if (revision !== this.revision) return;
      for (const [id, entry] of Object.entries(data.schoolEntries)) {
        const previous = this.state.data?.schoolEntries[id];
        if (previous && previous.checkedInAt === entry.checkedInAt && previous.students === entry.students && previous.companions === entry.companions) data.schoolEntries[id] = previous;
      }
      this.dirty = false;
      this.lastRead = Date.now();
      this.update({ data, error: false, refreshing: true });
    } catch {
      // A failed read must never masquerade as absence or expose revoked data.
      if (this.active && this.request === request && (this.blocked || revision === this.revision)) this.update({ data: null, error: true, refreshing: true });
    } finally {
      clearTimeout(timeout);
      if (this.active && this.request === request) {
        this.request = null;
        this.update({ ...this.state, refreshing: false });
        if (revision !== this.revision && !this.blocked) void this.read();
        else if (!this.summaryOnly && !this.blocked) this.timer = setTimeout(() => { void this.read(); }, ATTENDANCE_RECONCILE_MS);
      }
    }
  }
}
