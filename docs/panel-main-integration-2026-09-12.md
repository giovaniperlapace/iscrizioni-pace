# Integrazione di main nel branch panel — 2026-09-12

## Perimetro

Base panel `39deb81`; incorporato `origin/main` a `0bc2997` tramite merge
sul solo `codex/panel-p0-p10`. Nessun cambiamento a `main`, push, deployment,
applicazione SQL remota o invio email in questa attività. `output/` preesistente
resta escluso. P11 non è stata avviata.

## Analisi dei commit

Nessuno dei 10 commit risulta patch-equivalente a un commit panel (`git cherry`).
Il merge incorpora lo stato finale della sequenza: non occorre scartare commit
o ripetere modifiche intermedie. Le dipendenze tra correzioni sono conservate.

| Commit main | Esito nel branch panel |
| --- | --- |
| `c0c83dc` | Recepite semplificazione duplicati, date, nomi email e prefissi telefono. La rimozione di Unisci dalla UI è una decisione di main, conservata. |
| `d5f77ab` | Correzione della fixture specifica di Next 16.2.9. Il suo effetto sulla proprietà `bfcacheId` non si trasferisce a Next 16.3.0 del panel, che la richiede: mantenuta la fixture compatibile con il lockfile panel. |
| `08824fe` | Recepite disponibilità dichiarate modificabili dal capogruppo e RPC dedicata; non sostituiscono check-in o prenotazioni panel. |
| `ff6a7cd` | Recepite notifiche di successo temporanee nelle aree condivise. Conservata la decisione panel `d60b072`: sole segnalazioni di errore nelle azioni di riga. |
| `0584f67` | Recepite istruzioni di accesso per inserimenti operativi, senza alterare i flussi scuole. |
| `d6e7c27` | Conservati batch da 100 anche nelle query panel; adattato il mock del test alle scelte canoniche panel, verificando tutte le 1.268 righe e i panel associati. |
| `64ef674` | Conservata la lingua derivata dal gruppo: completa le notifiche di `0584f67`. |
| `fc0acc2` | Conservati i filtri per utente autenticato in sessione e proxy; nessun ripristino del precedente scope errato. |
| `b4697d3` | Conservata la correzione Safari della tabella territoriale insieme al report panel. |
| `0bc2997` | Conservati feedback di attesa, navigazione e download nelle aree condivise, insieme a layout e animazioni panel. |

## Conflitti e compatibilità

- `app/dashboard/capogruppo/page.tsx`: uniti gli import di main e quello della
  navigazione panel. Mantenute entrambe le funzionalità.
- `app/globals.css`: conservate entrambe le sezioni di animazione e le rispettive
  regole per movimento ridotto, chiudendo separatamente i blocchi CSS.
- Revisionati anche i merge automatici di action, dashboard, statistiche e
  campagne: restano pubblicazione, scuole, audience professori, quote e minori.
- Le dipendenze panel (Next 16.3.0, React 19.2.8) erano già state aggiornate
  e documentate. L'installazione locale era rimasta a Next 16.2.9 di main:
  `npm ci` la riallinea al lockfile panel senza modificare manifest o lockfile.
  Nessun downgrade necessario per incorporare le correzioni applicative.

## Migration staging

Inventario letto con transazione read-only nel container staging e confrontato
con tutte le migration del repository. Due versioni locali non registrate:

- `20260910120000_leader_attendance.sql`: nuova da main, necessaria prima di
  collaudare il salvataggio delle disponibilità del capogruppo nello staging.
  Anche la RPC risulta assente. Crea soltanto la funzione server, con EXECUTE
  riservato a service_role: nessun backfill, nuova tabella o modifica RLS.
  Le dipendenze di schema risultano registrate, incluse disponibilità a mezze
  giornate, evento corrente, gerarchia gruppi e soft delete. Non modifica
  `moment_attendance_choices`, `check_ins` o le quote dei panel.
- `20260813170000_rename_anziani_and_amici_groups.sql`: assenza preesistente,
  già documentata il 9 settembre; mancano i gruppi sorgente nella fixture.
  Non riapplicarla automaticamente e non registrarla come eseguita.

Non risultano altre migration da recepire. Tutte quelle panel presenti nel
repository sono registrate nello staging. Nessun file SQL già applicato è
stato riscritto. Per la sola migration nuova, dopo richiesta di applicazione:

```bash
npm run db:migrate:staging -- supabase/migrations/20260910120000_leader_attendance.sql
```

Poi verificare registrazione e privilegi della RPC e provare salvataggio e
rilettura con un capogruppo sintetico, controllando che le prenotazioni panel
restino invariate. Il salvataggio non può funzionare sulla preview aggiornata
finché questa migration non è applicata.

## Verifiche

- 322/322 test applicativi, lint e typecheck superati dopo `npm ci`.
- `npm run build:staging` superato, readiness OK, route panel/scuole incluse.
- `tests/sql/leader-attendance.sql` superato su PostgreSQL temporaneo locale:
  scope, dati invalidi, deduplicazione, sostituzione atomica, rollback su errore
  audit e divieto di invocazione per anon/authenticated. Database arrestato.
- Browser: home panel e scuole senza errori JavaScript, scuole anche mobile.
  Suite pending-feedback completa superata: navigazioni, salvataggi/errori,
  sette lingue, download, filtri e interruttori, desktop/mobile.
- Suite disponibilità capogruppo: lettura, modifica, disponibilità sconosciuta
  e validazione in sette lingue, mobile senza overflow. Il primo passaggio
  supera tutte le asserzioni funzionali ma segnala un errore browser vuoto
  (`✗`); ripetizione completa con diagnostica JSON superata (`errors: []`).
  Segnalazione iniziale non riprodotta, nessuna modifica applicativa per
  nasconderla. Fixture e runner diagnostico temporanei rimossi.
- Il collaudo autenticato del nuovo salvataggio sul database staging resta
  successivo all'applicazione della migration; nessun test su utenti reali.
