import { parseReceptionCommand, type ReceptionCommand, type ReceptionLookup, type ReceptionResult } from "./contracts.ts";

export type VerifiedReception = Extract<ReceptionResult, { status: "valid" }>;
export type ReceptionMode = "enter" | "correct" | "cancel";
export type RecentReception = { key: string; lookup: ReceptionLookup; result: VerifiedReception; readAt: string };
export type StationState = {
  recent: RecentReception[];
  mode: ReceptionMode;
  phase: "ready" | "pending" | "selection" | "result" | "error" | "uncertain" | "blocked";
  result: VerifiedReception | null;
  lookup: ReceptionLookup | null;
  retry: ReceptionCommand | null;
  message: string;
  problem?: Exclude<ReceptionResult["status"], "valid">;
};
const messages = {
  invalid: "Codice non valido o iscrizione non disponibile per questo evento.",
  forbidden: "Sessione scaduta o incarico non più autorizzato. Accedi di nuovo e verifica l’incarico prima di riprendere.",
  invalid_request: "Controlla il codice, le persone selezionate e le quantità inserite. Verifica di nuovo il codice.",
  conflict: "Un altro operatore ha aggiornato le presenze. Verifica di nuovo il codice prima di correggerle.",
  unavailable: "Esito da verificare. La scansione è sospesa: riprova la stessa richiesta senza ricaricare la pagina.",
};
export const EVENT_RECEPTION_DUTY = "event_entry" as const;

// A stable QR is read once. A sustained sequence of empty frames rearms it;
// short decoder gaps and camera restarts do not count as removal.
export class ScanLatch {
  private last: string | null = null;
  private emptySince: number | null = null;
  private previousEmpty: number | null = null;
  clearAbsence() { this.emptySince = this.previousEmpty = null; }
  absent(now = performance.now()) {
    if (this.previousEmpty === null || now - this.previousEmpty > 750) this.emptySince = now;
    this.previousEmpty = now;
    if (this.emptySince !== null && now - this.emptySince >= 1000) this.last = null;
  }
  accept(value: string) {
    this.clearAbsence();
    if (value === this.last) return false;
    this.last = value;
    return true;
  }
}

// Synchronous state is also the interlock: two frames/clicks in the same render
// cannot start two operations. No QR, identity or request is persisted locally.
export class ReceptionStationSession {
  private state: StationState = { recent: [], mode: "enter", phase: "ready", result: null, lookup: null, retry: null, message: "" };
  private listeners = new Set<() => void>();
  private commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
  private requestId: () => string;
  private timeoutMs: number;
  private active = true;
  constructor(commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>, requestId: () => string, timeoutMs = 20000) {
    this.commandAction = commandAction; this.requestId = requestId; this.timeoutMs = timeoutMs;
  }
  setActive(active: boolean) { this.active = active; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<StationState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  isLocked() { return ["pending", "uncertain", "blocked"].includes(this.state.phase); }
  canScan() { return this.state.mode === "enter" && ["ready", "result", "error"].includes(this.state.phase); }
  setMode(mode: ReceptionMode) {
    if (this.isLocked()) return;
    this.update({ mode, phase: "ready", result: null, lookup: null, message: "", problem: undefined, retry: null });
  }
  next() {
    if (this.isLocked()) return;
    this.update({ phase: "ready", result: null, lookup: null, message: "", problem: undefined, retry: null });
  }
  async inspect(lookup: ReceptionLookup) {
    if (this.isLocked() || this.state.phase === "selection") return;
    const command = parseReceptionCommand({ duty: EVENT_RECEPTION_DUTY, action: "inspect", lookup });
    this.update({ result: null, lookup: null, message: "", problem: undefined });
    if (!command) { this.update({ phase: "error", problem: "invalid", message: messages.invalid }); return; }
    this.update({ lookup: command.lookup });
    await this.run(command);
  }
  async editRecent(key: string) {
    if (this.isLocked() || this.state.phase === "selection") return;
    const entry = this.state.recent.find(item => item.key === key);
    if (entry) await this.edit(entry.lookup);
  }
  async editCurrent() {
    if (this.isLocked() || !this.state.result || !this.state.lookup) return;
    await this.edit(this.state.lookup);
  }
  private async edit(lookup: ReceptionLookup) {
    this.setMode("correct");
    await this.inspect(lookup);
  }
  private remember(result: VerifiedReception, lookup: ReceptionLookup, reading: boolean) {
    // Schools have only QR lookup; families deduplicate QR and manual reads by public code.
    const key = result.kind === "family" ? `family:${result.code}` : `school:${lookup.value}`;
    const existing = this.state.recent.find(item => item.key === key);
    const entry = { key, lookup, result, readAt: reading || !existing ? new Date().toISOString() : existing.readAt };
    const recent = reading || !existing ? [entry, ...this.state.recent.filter(item => item.key !== key)].slice(0, 15)
      : this.state.recent.map(item => item.key === key ? entry : item);
    this.update({ recent });
  }
  async submit(values: Pick<ReceptionCommand, "subjectIds" | "students" | "companions">, confirmed = false, cancelSchool = false) {
    if (this.state.phase !== "selection" || !this.state.lookup || !this.state.result) return;
    if (this.state.mode !== "enter" && !confirmed) return;
    const cancelAll = this.state.mode === "correct" && (this.state.result.kind === "family"
      ? values.subjectIds?.length === 0 : cancelSchool);
    const action = cancelAll ? "cancel" : this.state.mode;
    if (cancelAll && this.state.result.kind === "family") {
      values = { subjectIds: this.state.result.persons.filter(person => person.checkedInAt).map(person => person.id) };
      if (!values.subjectIds?.length) return;
    }
    if (cancelAll && this.state.result.kind === "school") values = {};
    const command: ReceptionCommand = {
      duty: EVENT_RECEPTION_DUTY, lookup: this.state.lookup, action, requestId: this.requestId(), ...values,
      ...(this.state.mode === "enter" ? {} : {
        expectedRevision: this.state.result.revision,
        reason: action === "cancel" ? "entry_cancelled" : this.state.result.kind === "family" ? "selection_error" : "count_error",
      }),
    };
    if (!parseReceptionCommand(command)) return;
    await this.run(command);
  }
  async retry() {
    if (this.state.phase !== "uncertain" || !this.state.retry) return;
    await this.run(this.state.retry);
  }
  private async call(command: ReceptionCommand): Promise<ReceptionResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.commandAction(command),
        new Promise<ReceptionResult>(resolve => { timer = setTimeout(() => resolve({ status: "unavailable" }), this.timeoutMs); }),
      ]);
    } catch { return { status: "unavailable" }; }
    finally { clearTimeout(timer); }
  }
  private async run(command: ReceptionCommand) {
    this.update({ phase: "pending", message: "", problem: undefined, retry: null });
    const response = await this.call(command);
    if (!this.active) return;
    if (response.status !== "valid") {
      this.update({
        phase: response.status === "unavailable" ? "uncertain" : response.status === "forbidden" ? "blocked" : "error",
        result: null,
        recent: response.status === "forbidden" ? [] : response.status === "invalid" ? this.state.recent.filter(item => item.lookup.kind !== command.lookup.kind || item.lookup.value !== command.lookup.value) : this.state.recent,
        problem: response.status, retry: response.status === "unavailable" ? command : null, message: response.status === "conflict" && this.state.mode !== "enter" ? "Un altro operatore ha aggiornato le presenze. Riapri Modifica presenze dalle ultime letture per verificare i dati aggiornati." : messages[response.status],
      });
      return;
    }
    this.remember(response, command.lookup, command.action === "inspect" && this.state.mode === "enter");
    if (command.action === "inspect") {
      this.update({ result: response });
      if (this.state.mode === "enter" && response.kind === "family" && response.persons.every(person => person.checkedInAt)) {
        this.update({ phase: "result", message: "Presenze già registrate: nessuna modifica." });
      } else if (this.state.mode === "enter" && response.kind === "family" && response.persons.length === 1) {
        // Keep the pending interlock across verification and automatic entry.
        await this.run({ duty: EVENT_RECEPTION_DUTY, lookup: command.lookup, action: "enter", requestId: this.requestId(), subjectIds: [response.persons[0].id] });
      } else if (this.state.mode === "enter" && response.kind === "school" && response.checkedInAt) {
        this.update({ phase: "result", message: "Ingresso già registrato." });
      } else this.update({ phase: "selection" });
      return;
    }
    this.update({ phase: "result", mode: "enter", result: response, message:
      response.outcome === "replayed" ? "Richiesta già elaborata. Verifica qui le presenze correnti." :
      response.outcome === "unchanged" ? "Presenze già registrate: nessuna modifica." :
      command.action === "enter" ? "Ingresso registrato." : command.action === "cancel" ? "Annullamento registrato." : "Correzione registrata.",
    });
  }
}
