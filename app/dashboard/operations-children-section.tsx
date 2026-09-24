"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/pending-link";
import { LocalQueryLink } from "@/components/local-query-link";
import { buildChildrenOverview } from "@/lib/registrations/children-overview";
import type { OperationsParticipantRow } from "@/lib/registrations/operations-types";

const cell = "px-3 py-3";
const heading = "h-15 whitespace-nowrap px-3 py-2 font-semibold";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2";
const nameLink =
  "inline-flex min-h-11 items-center font-semibold text-[var(--peace-blue-800)] underline decoration-dotted underline-offset-4";
const dateLabel = (date: string | null) =>
  date ? date.split("-").reverse().join("/") : "Da verificare";

export function OperationsChildrenSection({
  participants,
  eventId,
  eventStartsOn,
  dashboard,
  navMode,
}: {
  participants: OperationsParticipantRow[];
  eventId: string | null;
  eventStartsOn: string | null;
  dashboard: "manager" | "admin";
  navMode: "full" | "mini";
}) {
  const params = useSearchParams();
  const query = params.get("childrenQuery") ?? "";
  const group = params.get("childrenGroup") ?? "";
  const overview = useMemo(
    () => buildChildrenOverview(participants, eventId, eventStartsOn),
    [participants, eventId, eventStartsOn],
  );
  const needle = query.trim().toLocaleLowerCase("it");
  const matches = (person: OperationsParticipantRow, name: string) =>
    (!group ||
      (group === "none"
        ? !person.currentGroupId
        : person.currentGroupId === group)) &&
    `${name} ${person.name} ${person.email ?? ""} ${person.currentGroupName ?? ""}`
      .toLocaleLowerCase("it")
      .includes(needle);
  const children = overview.children
    .filter((child) => matches(child.parent, child.name))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  const independent = overview.independent
    .filter(({ participant }) => matches(participant, participant.name))
    .sort((a, b) => a.participant.name.localeCompare(b.participant.name, "it"));
  const groups = [
    ...new Map(
      participants
        .filter(
          (p) => p.eventId === eventId && !p.deletedAt && p.currentGroupId,
        )
        .map((p) => [
          p.currentGroupId!,
          p.currentGroupName ?? "Gruppo senza nome",
        ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "it"));
  const href = (id: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("section", "iscritti");
    next.set("view", "children");
    next.set("nav", navMode);
    next.set("edit", id);
    return `/dashboard/${dashboard}?${next}`;
  };
  return (
    <section
      className="grid min-w-0 gap-6"
      aria-label="Figli accompagnati e iscritti sotto i 15 anni"
    >
      <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold">Figli accompagnati</h2>
          <p className="mt-2 text-sm text-[var(--peace-muted)]">
            Una riga per ogni figlio accompagnato, con il genitore collegato
            espandibile. Più in basso trovi le persone sotto i 15 anni con una
            propria iscrizione.
          </p>
          <p className="mt-2 text-sm">
            Età all’inizio dell’evento: {dateLabel(eventStartsOn)}. I figli
            accompagnati sono elencati a qualsiasi età.
          </p>
          <dl className="my-4 grid gap-x-6 gap-y-3 border-y border-[var(--peace-border)] py-3 sm:grid-cols-3">
            {[
              ["Figli accompagnati", overview.children.length],
              ["Figli accompagnati sotto i 15 anni", overview.childrenUnder15],
              [
                "Iscritti autonomi sotto i 15 anni",
                overview.independent.length,
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-[var(--peace-muted)]">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--peace-blue-900)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-[var(--peace-muted)]">
            Conteggi dell’intero evento, prima dei filtri. Gli iscritti autonomi
            escludono i figli accompagnati.
          </p>
          {overview.unknownAges > 0 && (
            <p className="mt-2 text-sm">
              {overview.unknownAges} iscrizioni con età da verificare, escluse
              dalla selezione sotto i 15 anni.
            </p>
          )}
        </div>
        <form
          className="my-4 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
          action={`/dashboard/${dashboard}`}
        >
          <input type="hidden" name="section" value="iscritti" />
          <input type="hidden" name="view" value="children" />
          <input type="hidden" name="nav" value={navMode} />
          <label className="grid gap-1 text-sm">
            Cerca figlio, iscritto o genitore
            <input
              key={query}
              name="childrenQuery"
              defaultValue={query}
              className="field"
              type="search"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Gruppo
            <select
              key={group}
              name="childrenGroup"
              defaultValue={group}
              className="field"
            >
              <option value="">Tutti i gruppi</option>
              <option value="none">Senza gruppo</option>
              {groups.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass} type="submit">
            Filtra
          </button>
          <Link
            className={buttonClass}
            href={`/dashboard/${dashboard}?section=iscritti&view=children&nav=${navMode}`}
          >
            Azzera filtri
          </Link>
        </form>
        <div className="min-w-0">
          <h3 className="mb-3 text-sm text-[var(--peace-muted)]">
            Figli accompagnati · {children.length}
          </h3>
          <div
            className="overflow-x-auto rounded-md border border-[var(--peace-border)]"
            tabIndex={0}
            role="region"
            aria-label="Tabella figli accompagnati"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--peace-sky-100)]">
                <tr>
                  {[
                    "Figlio accompagnato / genitore",
                    "Data di nascita",
                    "Età",
                    "Gruppo del genitore",
                  ].map((label) => (
                    <th scope="col" className={heading} key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {children.map((child) => (
                  <tr
                    className="border-t border-[var(--peace-border)] align-top hover:bg-[#f7fbfe]"
                    key={child.id}
                  >
                    <th scope="row" className={`${cell} font-normal`}>
                      <div className="min-w-40 max-w-72">
                        <LocalQueryLink
                          className={nameLink}
                          href={href(child.parent.registrationId)}
                          aria-label={`Apri la scheda del genitore di ${child.name}`}
                          scroll={false}
                        >
                          {child.name}
                        </LocalQueryLink>
                        <details className="mt-2">
                          <summary className="min-h-11 cursor-pointer rounded-md bg-[var(--peace-sky-100)] px-2 py-3 text-xs font-semibold text-[var(--peace-blue-800)]">
                            Genitore: {child.parent.name}
                          </summary>
                          <div className="mt-2 grid gap-1 break-words border-l-2 border-[var(--peace-border-strong)] pl-2 text-xs leading-5 text-[var(--peace-muted)]">
                            <p>
                              {child.parent.email ?? "Email non disponibile"}
                            </p>
                            <p>
                              {child.parent.phone ?? "Telefono non disponibile"}
                            </p>
                            <p>{child.parent.place}</p>
                            <Link
                              className="inline-flex min-h-11 items-center font-semibold text-[var(--peace-blue-800)] underline decoration-dotted underline-offset-4"
                              href={href(child.parent.registrationId)}
                              scroll={false}
                            >
                              Apri scheda di {child.parent.name}
                            </Link>
                          </div>
                        </details>
                      </div>
                    </th>
                    <td className={cell}>{dateLabel(child.birthDate)}</td>
                    <td className={cell}>
                      {child.age === null
                        ? "Da verificare"
                        : `${child.age} anni`}
                    </td>
                    <td className={cell}>
                      {child.parent.currentGroupName ?? "Senza gruppo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!children.length && (
            <p className="p-4 text-sm">
              Nessun figlio accompagnato corrisponde alla selezione.
            </p>
          )}
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-4 sm:p-5">
        <h3 className="text-lg font-semibold">
          Iscritti autonomi sotto i 15 anni · {independent.length}
        </h3>
        <p className="my-3 text-sm text-[var(--peace-muted)]">
          Persone con una propria scheda di iscrizione, anche inserita da un
          genitore o da un operatore. Figli accompagnati esclusi; non è
          necessario un account personale.
        </p>
        <div
          className="overflow-x-auto rounded-md border border-[var(--peace-border)]"
          tabIndex={0}
          role="region"
          aria-label="Tabella iscritti autonomi sotto i 15 anni"
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[var(--peace-sky-100)]">
              <tr>
                {[
                  "Partecipante",
                  "Data di nascita",
                  "Età",
                  "Gruppo",
                  "Email",
                ].map((label) => (
                  <th scope="col" className={heading} key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {independent.map(({ participant, age }) => (
                <tr
                  key={participant.registrationId}
                  className="border-t border-[var(--peace-border)] align-top hover:bg-[#f7fbfe]"
                >
                  <th scope="row" className={`${cell} min-w-40 max-w-72`}>
                    <LocalQueryLink
                      className={nameLink}
                      href={href(participant.registrationId)}
                      scroll={false}
                    >
                      {participant.name}
                    </LocalQueryLink>
                  </th>
                  <td className={cell}>{dateLabel(participant.birthDate)}</td>
                  <td className={cell}>{age} anni</td>
                  <td className={cell}>
                    {participant.currentGroupName ?? "Senza gruppo"}
                  </td>
                  <td className={cell}>{participant.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!independent.length && (
          <p className="p-4 text-sm">
            Nessun iscritto autonomo sotto i 15 anni corrisponde alla selezione.
          </p>
        )}
      </section>
    </section>
  );
}
