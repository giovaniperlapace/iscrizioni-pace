import { parseReceptionCommand, type ReceptionCommand, type ReceptionLookup, type ReceptionResult } from "./contracts.ts";

export type VerifiedReception = Extract<ReceptionResult, { status: "valid" }>;
export type ReceptionMode = "enter" | "correct" | "cancel";
export type StationState = {
  mode: ReceptionMode;
  phase: "ready" | "pending" | "selection" | "result" | "error" | "uncertain" | "blocked";
  result: VerifiedReception | null;
  lookup: ReceptionLookup | null;
  retry: ReceptionCommand | null;
  message: string;
};
const messages = {
  invalid: "Codice non valido o iscrizione non disponibile per questo evento.",
  forbidden: "Sessione scaduta o incarico non più autorizzato. Accedi di nuovo e verifica l’incarico prima di riprendere.",
  invalid_request: "Controlla il codice, le persone selezionate e le quantità inserite. Verifica di nuovo il codice.",
  conflict: "Un altro operatore ha aggiornato le presenze. Verifica di nuovo il codice prima di correggerle.",
  unavailable: "Esito da verificare. La scansione è sospesa: riprova la stessa richiesta senza ricaricare la pagina.",
};
export const EVENT_RECEPTION_DUTY = "event_entry" as const;

// The last code stays latched through unreadable frames, errors and camera
// restarts. Only another code or an explicit operator action releases it.
export class ScanLatch {
  private last: string | null = null;
  accept(value: string) {
    if (value === this.last) return false;
    this.last = value;
    return true;
  }
  reset() { this.last = null; }
}

// Synchronous state is also the interlock: two frames/clicks in the same render
// cannot start two operations. No QR, identity or request is persisted locally.
export class ReceptionStationSession {
  private state: StationState = { mode: "enter", phase: "ready", result: null, lookup: null, retry: null, message: "" };
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
    this.update({ mode, phase: "ready", result: null, lookup: null, message: "", retry: null });
  }
  next() {
    if (this.isLocked()) return;
    this.update({ phase: "ready", result: null, lookup: null, message: "", retry: null });
  }
  async inspect(lookup: ReceptionLookup) {
    if (this.isLocked() || this.state.phase === "selection") return;
    const command = parseReceptionCommand({ duty: EVENT_RECEPTION_DUTY, action: "inspect", lookup });
    this.update({ result: null, lookup: null, message: "" });
    if (!command) { this.update({ phase: "error", message: messages.invalid }); return; }
    this.update({ lookup: command.lookup });
    await this.run(command);
  }
  async submit(values: Pick<ReceptionCommand, "subjectIds" | "students" | "companions">, confirmed = false) {
    if (this.state.phase !== "selection" || !this.state.lookup || !this.state.result) return;
    if (this.state.mode !== "enter" && !confirmed) return;
    const command: ReceptionCommand = {
      duty: EVENT_RECEPTION_DUTY, lookup: this.state.lookup, action: this.state.mode, requestId: this.requestId(), ...values,
      ...(this.state.mode === "enter" ? {} : {
        expectedRevision: this.state.result.revision,
        reason: this.state.mode === "cancel" ? "entry_cancelled" : this.state.result.kind === "family" ? "selection_error" : "count_error",
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
    this.update({ phase: "pending", message: "", retry: null });
    const response = await this.call(command);
    if (!this.active) return;
    if (response.status !== "valid") {
      this.update({
        phase: response.status === "unavailable" ? "uncertain" : response.status === "forbidden" ? "blocked" : "error",
        result: null, retry: response.status === "unavailable" ? command : null, message: messages[response.status],
      });
      return;
    }
    if (command.action === "inspect") {
      this.update({ result: response });
      if (this.state.mode === "enter" && response.kind === "family" && response.persons.length === 1) {
        // Keep the pending interlock across verification and automatic entry.
        await this.run({ duty: EVENT_RECEPTION_DUTY, lookup: command.lookup, action: "enter", requestId: this.requestId(), subjectIds: [response.persons[0].id] });
      } else if (this.state.mode === "enter" && response.kind === "school" && response.checkedInAt) {
        this.update({ phase: "result", message: "Ingresso già registrato. Per cambiare le quantità usa Correzioni." });
      } else this.update({ phase: "selection" });
      return;
    }
    this.update({ phase: "result", result: response, message:
      response.outcome === "replayed" ? "Richiesta già elaborata. Verifica qui le presenze correnti." :
      response.outcome === "unchanged" ? "Presenze già registrate: nessuna modifica." :
      command.action === "enter" ? "Ingresso registrato." : command.action === "cancel" ? "Annullamento registrato." : "Correzione registrata.",
    });
  }
}
