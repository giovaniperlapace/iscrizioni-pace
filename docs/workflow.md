# Workflow operativo

Questa guida fissa il ciclo minimo da usare per ogni milestone finché non esisteranno runbook più specifici.

## Prima di iniziare

Eseguire sempre:

```bash
pwd
git status --short
git branch --show-current
```

Usare `git remote -v` quando serve verificare il collegamento a GitHub.

Se la working tree e' sporca, leggere il diff prima di modificare file. Le modifiche non comprese vanno trattate come lavoro dell'utente e non vanno sovrascritte.

## Branch

Il lavoro ordinario avviene su `main`:

```bash
git switch main
```

Le prove si fanno in locale. Quando tutto funziona e l'utente chiede commit/push, fare commit e push direttamente su `main`.

Non creare branch staging/produzione o branch milestone salvo richiesta esplicita.

## Qualità

Prima di chiudere una milestone eseguire i comandi pertinenti:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` usa il test runner nativo di Node su `tests/*.test.mts`. Per ora serve come smoke test e come punto stabile per aggiungere test di funzioni pure. Quando arriveranno database, auth e RLS, i test dovranno distinguere chiaramente tra:

- test unitari senza servizi esterni;
- test di integrazione con Supabase locale o staging concordato;
- verifiche manuali documentate quando richiedono utenti/ruoli reali.

## Documentazione

Aggiornare `AGENTS.md` quando cambiano:

- comandi disponibili;
- variabili ambiente;
- struttura cartelle;
- ruoli, permessi, RLS o schema dati;
- flussi auth, registrazione, email, QR/check-in;
- decisioni operative che un futuro agente deve conoscere.

Usare documenti in `docs/` quando il dettaglio diventa troppo lungo per `AGENTS.md`.

## Supabase

Non operare su database reali senza:

- ambiente target esplicitamente confermato;
- URL e chiavi disponibili solo in `.env.local` o nei secret manager;
- migration versionata in repository;
- piano di verifica per schema, indici e RLS.

Il service role deve restare solo lato server o in strumenti operativi fidati.

## Chiusura milestone

Prima della risposta finale controllare:

```bash
git status --short
git diff
```

La risposta finale deve indicare file modificati, verifiche eseguite, eventuali verifiche non eseguite e rischi residui.
