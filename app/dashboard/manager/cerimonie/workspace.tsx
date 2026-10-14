"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/pending-link";
import { ReliableForm } from "@/components/reliable-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formFailure } from "@/lib/forms/result";
import {
  ceremonyErrors,
  ceremonyTitles,
  eligibilityLabels,
  type CeremonyKind,
  type CeremonyResult,
  type CeremonySnapshot,
} from "@/lib/ceremonies/contracts";

type Save = (form: FormData) => Promise<CeremonyResult>;
type Props = {
  kind: CeremonyKind;
  snapshot: CeremonySnapshot;
  admin: boolean;
  canManage: boolean;
  save: Save;
};
const box = "surface-card grid min-w-0 gap-4 p-5";
const help = "text-sm leading-6 text-[var(--peace-muted)]";
function Field({
  label,
  name,
  value,
  type = "text",
  required = false,
  maxLength = 100,
}: {
  label: string;
  name: string;
  value?: string | number | null;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        maxLength={maxLength}
        min={type === "number" ? 0 : undefined}
        max={type === "number" ? 1000000 : undefined}
        step={type === "number" ? 1 : undefined}
        className="field min-w-0 w-full font-normal"
      />
    </label>
  );
}
function Hidden({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}
function CommandForm({
  kind,
  revision,
  operation,
  save,
  children,
  label,
  id,
}: {
  kind: CeremonyKind;
  revision: number;
  operation: string;
  save: Save;
  children?: ReactNode;
  label: string;
  id?: string;
}) {
  const router = useRouter(),
    requestId = useRef<string>("");
  const [message, setMessage] = useState("");
  return (
    <ReliableForm
      locale="it"
      className="grid gap-3"
      action={async (form) => {
        setMessage("");
        if (operation !== "configure") {
          requestId.current ||= crypto.randomUUID();
          form.set("id", id ?? requestId.current);
        }
        let result: CeremonyResult;
        try {
          result = await save(form);
        } catch {
          result = { status: "unavailable" };
        }
        if (result.status !== "saved") {
          setMessage(
            ceremonyErrors[result.status] ?? ceremonyErrors.unavailable,
          );
          return formFailure([{ field: null, code: "invalid" }]);
        }
        router.refresh();
        setMessage("Modifica salvata.");
      }}
    >
      <Hidden name="kind" value={kind} />
      <Hidden name="revision" value={revision} />
      <Hidden name="operation" value={operation} />
      {children}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-[var(--peace-border)] p-3 text-sm"
        >
          {message}
        </p>
      )}
      <PendingSubmitButton className="btn-primary min-h-11 justify-self-start px-4">
        {label}
      </PendingSubmitButton>
    </ReliableForm>
  );
}
export function CeremonyWorkspace({
  kind,
  snapshot: s,
  admin,
  canManage,
  save,
}: Props) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [target, setTarget] = useState("group");
  const plan = s.plan,
    revision = plan?.revision ?? -1;
  const common = { kind, revision, save };
  const usedByQuota = new Map<string, number>();
  const quotaBySector = new Map<string, number>();
  const sectorById = new Map(s.sectors.map((sector) => [sector.id, sector]));
  const quotaById = new Map(s.quotas.map((quota) => [quota.id, quota]));
  for (const allocation of s.allocations)
    usedByQuota.set(
      allocation.quotaId,
      (usedByQuota.get(allocation.quotaId) ?? 0) + allocation.quantity,
    );
  for (const quota of s.quotas)
    quotaBySector.set(
      quota.sectorId,
      (quotaBySector.get(quota.sectorId) ?? 0) + quota.quantity,
    );
  const allocated = s.allocations.reduce((n, a) => n + a.quantity, 0);
  const quotaTotal = s.quotas.reduce((n, q) => n + q.quantity, 0);
  const sectorTotal = s.sectors.reduce(
    (n, sector) => n + (sector.capacity ?? 0),
    0,
  );
  const assigned = new Set(
    s.allocations.flatMap((a) => (a.registrationId ? [a.registrationId] : [])),
  );
  const people = s.people.filter((p) =>
    `${p.name} ${p.code}`
      .toLocaleLowerCase("it")
      .includes(query.toLocaleLowerCase("it")),
  );
  const groups = s.groups.filter((g) =>
    g.name.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")),
  );
  const ready = plan?.state === "validated";
  const quotaLabel = (id: string) => {
    const q = quotaById.get(id);
    return `${sectorById.get(q?.sectorId ?? "")?.name ?? ""} · ${q?.category ?? ""}`;
  };
  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Cerimonia" className="flex flex-wrap gap-2">
        {(["opening", "closing"] as const).map((k) => (
          <Link
            key={k}
            href={`/dashboard/manager/cerimonie?kind=${k}`}
            aria-current={kind === k ? "page" : undefined}
            className={
              kind === k
                ? "btn-primary min-h-11 px-5"
                : "btn-secondary min-h-11 px-5"
            }
          >
            {ceremonyTitles[k]}
          </Link>
        ))}
      </nav>
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{ceremonyTitles[kind]}</h2>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${ready ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}
          >
            {ready ? "Configurazione validata" : "Bozza · assegnazioni sospese"}
          </span>
        </div>
        <p>
          {plan?.location ?? "Sede da definire"} ·{" "}
          {plan?.startsAt
            ? `${plan.startsAt.slice(0, 10).split("-").reverse().join("/")} · ${plan.startsAt.slice(11)}–${plan.endsAt?.slice(11)} (Roma)`
            : "Data e orari da definire"}
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Capienza", plan?.capacity ?? "Da definire"],
            ["Quote ripartite", quotaTotal],
            ["Posti assegnati", allocated],
            [
              "Posti non assegnati",
              plan?.capacity == null
                ? "Da definire"
                : plan.capacity - allocated,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-[var(--peace-sky-100)] p-4"
            >
              <p className={help}>{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <p className={help}>
          Presenza prevista, posto assegnato e ingresso effettivo sono distinti.
          Questa vista assegna posti e non registra ingressi.
        </p>
        {!canManage && (
          <p className={help}>
            Sola lettura: le modifiche sono riservate ai responsabili.
          </p>
        )}
      </section>
      <section className={box}>
        <h2 className="text-lg font-semibold">1. Sede e capienza</h2>
        <p className={help}>
          Configurazione riservata all’admin, indipendente dall’altra cerimonia.
          Campo capienza vuoto = da definire; zero = nessun posto. I settori
          quantitativi potranno essere completati con file e sedute nella fase
          delle piantine.
        </p>
        {admin ? (
          <details open={!plan}>
            <summary className="cursor-pointer py-2 font-semibold">
              {plan ? "Modifica configurazione" : "Prepara la sede"}
            </summary>
            <CommandForm
              key={revision}
              {...common}
              operation="configure"
              label="Salva configurazione"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="location"
                  label="Nome della sede"
                  value={plan?.location ?? "Sede da definire"}
                  required
                />
                <Field
                  name="capacity"
                  label="Capienza totale"
                  value={plan?.capacity}
                  type="number"
                />
                <Field
                  name="startsAt"
                  label="Inizio · ora di Roma"
                  value={plan?.startsAt}
                  type="datetime-local"
                />
                <Field
                  name="endsAt"
                  label="Fine · ora di Roma"
                  value={plan?.endsAt}
                  type="datetime-local"
                />
                <label className="grid gap-1 text-sm font-semibold">
                  Presenza dichiarata richiesta
                  <select
                    name="attendancePart"
                    defaultValue={plan?.attendancePart ?? "day"}
                    className="field font-normal"
                  >
                    <option value="day">Almeno una fascia nel giorno</option>
                    <option value="morning">Mattina</option>
                    <option value="afternoon">Pomeriggio</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Stato della configurazione
                  <select
                    name="state"
                    defaultValue={plan?.state ?? "draft"}
                    className="field font-normal"
                  >
                    <option value="draft">Bozza</option>
                    <option value="validated">
                      Validata · abilita assegnazioni
                    </option>
                  </select>
                </label>
              </div>
              <p className={help}>
                Valida solo dopo aver confermato sede reale, orari e capienze di
                tutti i settori. Con posti assegnati, sede e orari restano
                protetti fino alla revoca esplicita delle assegnazioni.
              </p>
            </CommandForm>
          </details>
        ) : (
          <p className={help}>
            L’admin prepara e valida la configurazione della sede.
          </p>
        )}
        {plan && (
          <>
            <h3 className="font-semibold">
              Settori · {sectorTotal} posti definiti
            </h3>
            {s.sectors.length === 0 && (
              <p className={help}>Nessun settore configurato.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {s.sectors.map((sector) => (
                <article
                  className="grid gap-2 rounded-xl border border-[var(--peace-border)] p-4"
                  key={sector.id}
                >
                  <h4 className="font-semibold">
                    {sector.name} · {sector.capacity ?? "Da definire"}
                  </h4>
                  <p className={help}>
                    Quote: {quotaBySector.get(sector.id) ?? 0} · Non ripartiti:{" "}
                    {sector.capacity == null
                      ? "da definire"
                      : sector.capacity - (quotaBySector.get(sector.id) ?? 0)}
                  </p>
                  {admin && (
                    <details>
                      <summary className="cursor-pointer py-2">
                        Modifica settore
                      </summary>
                      <CommandForm
                        key={revision}
                        {...common}
                        operation="sector"
                        id={sector.id}
                        label="Salva settore"
                      >
                        <Field
                          name="name"
                          label="Nome settore"
                          value={sector.name}
                          required
                        />
                        <Field
                          name="capacity"
                          label="Capienza settore"
                          type="number"
                          value={sector.capacity}
                        />
                      </CommandForm>
                    </details>
                  )}
                </article>
              ))}
            </div>
            {admin && (
              <details>
                <summary className="cursor-pointer py-2 font-semibold">
                  Aggiungi settore
                </summary>
                <CommandForm
                  key={revision}
                  {...common}
                  operation="sector"
                  label="Crea settore"
                >
                  <Field name="name" label="Nome settore" required />
                  <Field
                    name="capacity"
                    label="Capienza settore"
                    type="number"
                  />
                </CommandForm>
              </details>
            )}
          </>
        )}
      </section>
      {plan && (
        <>
          <section className={box}>
            <h2 className="text-lg font-semibold">2. Quote per categoria</h2>
            <p className={help}>
              Ogni categoria è definita esplicitamente per il settore. La somma
              delle quote non può superarne la capienza. Le categorie non
              attribuiscono automaticamente diritti di accesso.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.quotas.map((q) => {
                const used = usedByQuota.get(q.id) ?? 0;
                return (
                  <article
                    className="grid gap-2 rounded-xl border border-[var(--peace-border)] p-4"
                    key={q.id}
                  >
                    <h3 className="font-semibold">{quotaLabel(q.id)}</h3>
                    <p>
                      {used} assegnati / {q.quantity} · {q.quantity - used}{" "}
                      disponibili
                    </p>
                    {canManage && (
                      <details>
                        <summary className="cursor-pointer py-2">
                          Modifica quota
                        </summary>
                        <CommandForm
                          key={revision}
                          {...common}
                          operation="quota"
                          id={q.id}
                          label="Salva quota"
                        >
                          <Hidden name="sectorId" value={q.sectorId} />
                          <Field
                            name="category"
                            label="Categoria"
                            value={q.category}
                            maxLength={80}
                            required
                          />
                          <Field
                            name="quantity"
                            label="Posti nella quota"
                            type="number"
                            value={q.quantity}
                            required
                          />
                        </CommandForm>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
            {canManage && s.sectors.length > 0 && (
              <details>
                <summary className="cursor-pointer py-2 font-semibold">
                  Aggiungi quota
                </summary>
                <CommandForm
                  key={revision}
                  {...common}
                  operation="quota"
                  label="Crea quota"
                >
                  <label className="grid gap-1 text-sm font-semibold">
                    Settore
                    <select
                      name="sectorId"
                      className="field"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Scegli settore
                      </option>
                      {s.sectors.map((sector) => (
                        <option
                          key={sector.id}
                          value={sector.id}
                          disabled={sector.capacity === null}
                        >
                          {sector.name} ·{" "}
                          {sector.capacity ?? "capienza da definire"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    name="category"
                    label="Categoria"
                    required
                    maxLength={80}
                  />
                  <Field
                    name="quantity"
                    label="Posti nella quota"
                    type="number"
                    required
                  />
                </CommandForm>
              </details>
            )}
          </section>
          <section className={box}>
            <h2 className="text-lg font-semibold">3. Assegna posti</h2>
            <p className={help}>
              La dotazione a un gruppo occupa subito i posti. La distribuzione
              ai suoi membri è gestibile da manager e capogruppo nella vista di
              distribuzione nominale. I conteggi qui riguardano le iscrizioni
              principali del solo gruppo selezionato; non includono sottogruppi
              o figli accompagnati. L’assegnazione diretta attribuisce un posto
              alla persona indicata, senza posti automatici ai figli.
            </p>
            <label className="grid gap-1 text-sm font-semibold">
              Cerca persona, codice o gruppo
              <input
                type="search"
                className="field"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {canManage && ready && s.quotas.length > 0 ? (
              <CommandForm
                key={revision}
                {...common}
                operation="allocate"
                label="Conferma assegnazione"
              >
                <label className="grid gap-1 text-sm font-semibold">
                  Quota
                  <select
                    name="quotaId"
                    className="field"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Scegli quota
                    </option>
                    {s.quotas.map((q) => (
                      <option key={q.id} value={q.id}>
                        {quotaLabel(q.id)} ·{" "}
                        {q.quantity - (usedByQuota.get(q.id) ?? 0)} disponibili
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Destinatario
                  <select
                    className="field"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="group">Gruppo</option>
                    <option value="person">Persona</option>
                  </select>
                </label>
                {target === "group" ? (
                  <>
                    <label className="grid gap-1 text-sm font-semibold">
                      Gruppo
                      <select
                        key={`group:${query}`}
                        name="groupId"
                        className="field"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Scegli gruppo
                        </option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} · {g.eligible} presenze previste
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="quantity"
                      label="Posti da assegnare al gruppo"
                      type="number"
                      required
                    />
                  </>
                ) : (
                  <>
                    <label className="grid gap-1 text-sm font-semibold">
                      Persona
                      <select
                        key={`person:${query}`}
                        name="registrationId"
                        className="field"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Scegli persona
                        </option>
                        {people
                          .filter(
                            (p) =>
                              p.eligibility === "eligible" &&
                              !assigned.has(p.id),
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.code}
                              {p.children.length
                                ? ` · ${p.children.length} figli accompagnati`
                                : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Hidden name="quantity" value="1" />
                  </>
                )}
              </CommandForm>
            ) : (
              <p className={help}>
                {!ready
                  ? "Assegnazioni disponibili dopo la validazione dell’admin."
                  : !s.quotas.length
                    ? "Definisci almeno una quota per assegnare posti."
                    : "Assegnazioni consultabili in sola lettura."}
              </p>
            )}
            <details>
              <summary className="cursor-pointer py-2 font-semibold">
                Presenze previste · {people.length} persone
              </summary>
              <p className={help}>
                Le date non comunicate restano da verificare. La regola di
                presenza è scelta dall’admin nella configurazione.
              </p>
              <ul className="divide-y divide-[var(--peace-border)]">
                {people.slice(page * 50, page * 50 + 50).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2 py-3"
                  >
                    <div>
                      <span>
                        {p.name} · {p.code}
                      </span>
                      {p.children.map((child) => (
                        <p key={child.id} className={help}>
                          {child.name} · minore accompagnato, scelta individuale
                          nella distribuzione nominale
                        </p>
                      ))}
                    </div>
                    <span>
                      {eligibilityLabels[p.eligibility]}
                      {assigned.has(p.id) ? " · posto assegnato" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-secondary min-h-11 px-3"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Precedenti
                </button>
                <span>
                  Pagina {page + 1} di{" "}
                  {Math.max(1, Math.ceil(people.length / 50))}
                </span>
                <button
                  type="button"
                  className="btn-secondary min-h-11 px-3"
                  disabled={(page + 1) * 50 >= people.length}
                  onClick={() => setPage(page + 1)}
                >
                  Successivi
                </button>
              </div>
            </details>
          </section>
          <section className={box}>
            <h2 className="text-lg font-semibold">Assegnazioni attive</h2>
            {s.allocations.length === 0 && (
              <p className={help}>Nessun posto assegnato.</p>
            )}
            {s.allocations.map((a) => (
              <article
                key={a.id}
                className="grid gap-2 rounded-xl border border-[var(--peace-border)] p-4"
              >
                <h3 className="font-semibold">
                  {a.name} · {a.quantity} {a.quantity === 1 ? "posto" : "posti"}
                </h3>
                <p className={help}>
                  {a.groupId ? "Dotazione gruppo" : "Assegnazione personale"} ·{" "}
                  {quotaLabel(a.quotaId)}
                </p>
                {a.review && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    Da rivedere: iscrizione, gruppo o presenza dichiarata sono
                    cambiati. I posti restano occupati fino alla revoca.
                  </p>
                )}
                {canManage && (
                  <details>
                    <summary className="cursor-pointer py-2">
                      Revoca assegnazione
                    </summary>
                    <CommandForm
                      key={revision}
                      {...common}
                      operation="revoke"
                      id={a.id}
                      label="Conferma revoca"
                    >
                      <p className={help}>
                        La revoca libera {a.quantity} posti nella quota. Per
                        cambiare dotazione, revoca e crea una nuova
                        assegnazione.
                      </p>
                    </CommandForm>
                  </details>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
