"use client";
import { useState } from "react";
import { ReliableForm } from "@/components/reliable-form";
import { ProgressButton } from "@/components/button-progress";
import { CeremonySeatMap } from "./ceremony-seat-map";
import {
  validMapSeats,
  type MapSeat,
  type SeatMapView,
} from "@/lib/ceremonies/seat-map";
export function CeremonyMapEditor({
  view,
  blocked,
  saveDraft,
  publish,
}: {
  view: SeatMapView;
  blocked: boolean;
  saveDraft: (title: string, seats: MapSeat[]) => Promise<boolean>;
  publish: () => void;
}) {
  const source = view.draft ?? view.active;
  const [title, setTitle] = useState(source?.title ?? ""),
    [seats, setSeats] = useState<MapSeat[]>(source?.seats ?? []),
    [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState("");
  const seat = seats.find((s) => s.id === selected);
  function update(next: MapSeat[]) {
    setSeats(next);
    setDirty(true);
    setMessage("");
  }
  async function addRow(data: FormData) {
    const count = Number(data.get("count")),
      start = Number(data.get("start")),
      x = Number(data.get("x")),
      y = Number(data.get("y")),
      step = Number(data.get("step"));
    if (!Number.isInteger(count) || count < 1 || count > 200) return;
    const row = String(data.get("row")).trim(),
      sectorId = String(data.get("sector"));
    const next = [
      ...seats,
      ...Array.from({ length: count }, (_, i) => ({
        id: crypto.randomUUID(),
        sectorId,
        row,
        number: String(start + i),
        x: x + i * step,
        y,
        blocked: false,
      })),
    ];
    if (!validMapSeats(next)) {
      setMessage(
        "Controlla etichette duplicate, coordinate e limite di 10.000 sedute.",
      );
      return;
    }
    update(next);
  }
  return (
    <details className="surface-card min-w-0 p-5">
      <summary className="cursor-pointer font-semibold">
        Editor admin · bozza e versioni
      </summary>
      <div className="mt-5 grid min-w-0 gap-5">
        <p>
          Le modifiche restano in bozza fino alla pubblicazione esplicita.
          Coordinate in unità della piantina; ogni seduta conserva la propria
          identità. Capienze e settori si configurano nella gestione cerimonie.
        </p>
        <label className="grid gap-2">
          Titolo della piantina
          <input
            className="field"
            required
            maxLength={100}
            value={title}
            disabled={blocked}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <ReliableForm
          action={addRow}
          locale="it"
          className="grid gap-3 sm:grid-cols-3"
        >
          <fieldset disabled={blocked} className="contents">
            <legend className="font-semibold">Aggiungi una fila</legend>
            <label className="grid gap-1">
              Settore
              <select className="field" name="sector" required>
                {view.sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              Fila
              <input className="field" name="row" required maxLength={30} />
            </label>
            {(
              [
                ["start", "Primo numero", 1, 1, 100000],
                ["count", "Numero di sedute", 10, 1, 200],
                ["x", "Posizione X", 0, 0, 10000],
                ["y", "Posizione Y", 0, 0, 10000],
                ["step", "Distanza fra sedute", 60, 45, 500],
              ] as const
            ).map(([name, label, def, min, max]) => (
              <label key={name} className="grid gap-1">
                {label}
                <input
                  className="field"
                  type="number"
                  name={name}
                  defaultValue={def}
                  min={min}
                  max={max}
                  required
                />
              </label>
            ))}
            <ProgressButton
              className="btn-secondary min-h-11 px-3"
              type="submit"
            >
              Aggiungi alla bozza
            </ProgressButton>
          </fieldset>
        </ReliableForm>
        <CeremonySeatMap
          seats={seats}
          sectors={view.sectors}
          claims={[]}
          allocationId=""
          selected={selected ? [selected] : []}
          onSelect={setSelected}
          disabled={blocked}
          locale="it"
        />
        <label className="grid gap-1">
          Modifica una seduta (incluse quelle non utilizzabili)
          <select
            className="field"
            value={selected}
            disabled={blocked}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Seleziona</option>
            {seats.map((s) => (
              <option key={s.id} value={s.id}>
                {view.sectors.find((v) => v.id === s.sectorId)?.name} · {s.row}{" "}
                / {s.number}
              </option>
            ))}
          </select>
        </label>
        {seat && (
          <ReliableForm
            key={seat.id}
            locale="it"
            className="grid gap-3 sm:grid-cols-3"
            action={async (data) => {
              const next = seats.map((s) =>
                s.id === seat.id
                  ? {
                      ...s,
                      row: String(data.get("row")).trim(),
                      number: String(data.get("number")).trim(),
                      x: Number(data.get("x")),
                      y: Number(data.get("y")),
                      blocked: data.get("blocked") === "on",
                    }
                  : s,
              );
              if (!validMapSeats(next)) {
                setMessage("Etichette duplicate o coordinate non valide.");
                return;
              }
              update(next);
            }}
          >
            <fieldset className="contents" disabled={blocked}>
              <legend>Proprietà della seduta</legend>
              {(["row", "number", "x", "y"] as const).map((k, i) => (
                <label className="grid gap-1" key={k}>
                  {["Fila", "Posto", "Posizione X", "Posizione Y"][i]}
                  <input
                    name={k}
                    className="field"
                    required
                    type={i > 1 ? "number" : "text"}
                    min={i > 1 ? 0 : undefined}
                    max={i > 1 ? 10000 : undefined}
                    maxLength={i < 2 ? 30 : undefined}
                    step={i > 1 ? "any" : undefined}
                    defaultValue={seat[k]}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input
                  name="blocked"
                  type="checkbox"
                  defaultChecked={seat.blocked}
                />
                Non utilizzabile
              </label>
              <ProgressButton
                type="submit"
                className="btn-secondary min-h-11 px-3"
              >
                Aggiorna nella bozza
              </ProgressButton>
              <button
                className="btn-secondary min-h-11 px-3"
                type="button"
                onClick={() => {
                  update(seats.filter((s) => s.id !== seat.id));
                  setSelected("");
                }}
              >
                Rimuovi dalla bozza
              </button>
            </fieldset>
          </ReliableForm>
        )}
        <p role="status">{message}</p>
        <div className="flex flex-wrap gap-3">
          <ProgressButton
            disabled={blocked || !title.trim()}
            type="button"
            className="btn-primary min-h-11 px-3"
            onClick={async () => {
              if (await saveDraft(title, seats)) setDirty(false);
            }}
          >
            Salva bozza
          </ProgressButton>
          <ProgressButton
            disabled={blocked || dirty || !view.draft}
            type="button"
            className="btn-primary min-h-11 px-3"
            onClick={publish}
          >
            Pubblica la versione salvata
          </ProgressButton>
        </div>
        {dirty && (
          <p>
            Salva la bozza prima di pubblicarla. Per evitare perdite, copia le
            modifiche prima di aggiornare la pagina.
          </p>
        )}
        <p>
          {seats.length} sedute · {seats.filter((s) => !s.blocked).length}{" "}
          utilizzabili
        </p>
        {view.history.length > 0 && (
          <details>
            <summary className="cursor-pointer">Versioni precedenti</summary>
            {view.history.map((v) => (
              <div
                className="my-3 flex flex-wrap items-center gap-3"
                key={v.id}
              >
                <span>
                  Versione {v.version} · {v.title} · {v.seats.length} sedute
                </span>
                <button
                  className="btn-secondary min-h-11 px-3"
                  disabled={blocked || dirty}
                  onClick={() => {
                    setTitle(v.title);
                    update(v.seats);
                    setSelected("");
                  }}
                >
                  Copia in bozza
                </button>
              </div>
            ))}
          </details>
        )}
      </div>
    </details>
  );
}
