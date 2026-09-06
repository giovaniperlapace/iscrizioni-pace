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

Dal 2026-09-05, salvo indicazione esplicita dell'utente, tutte le modifiche
avvengono su `main` nel checkout locale ordinario. Prima di modificare file
eseguire `git fetch origin`, verificare
lo stato locale e l'allineamento con `origin/main`, quindi eseguire
`git pull --ff-only` su `main` quando la working tree e' pulita.

Quando il lavoro e' destinato a `main` e il checkout e' su un altro branch,
controllare modifiche locali e commit
non integrati prima di passare a `main`, senza perdere, trascinare o integrare
automaticamente lavoro preesistente:

```bash
git switch main
```

Le prove si fanno in locale. Quando tutto funziona e l'utente chiede
commit/push, fare commit e push direttamente su `main`, salvo il lavoro
espressamente destinato al branch panel.

L'unica eccezione stabile e' `codex/panel-p0-p10`: questo branch DEVE restare
disponibile per lo staging dei panel e non va eliminato automaticamente,
neppure dopo un'integrazione. Usarlo per le modifiche solo quando l'utente
indica espressamente lo staging/branch panel; senza indicazioni si lavora su
`main`, anche per modifiche che riguardano i panel. Quando si lavora sul branch
panel, riallinearlo al proprio upstream e integrare periodicamente
`origin/main` con un merge, anche prima delle verifiche finali e
dell'integrazione in `main`; non fare rebase del branch condiviso.

Non creare autonomamente branch, worktree o pull request, anche per modifiche
lunghe, rischiose, parallele o che includono migration e permessi/RLS. Solo una
nuova richiesta esplicita dell'utente puo' cambiare questa scelta. Eventuali
branch e worktree preesistenti non vanno eliminati o integrati automaticamente.

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

## Apertura iscrizioni pubbliche

Prima di aprire iscrizioni reali, seguire `docs/opening-checklist.md`.

Eseguire almeno:

```bash
npm run opening:verify
npm run opening:verify:production
npm run email:verify
```

Questi comandi verificano configurazione production e SMTP senza stampare
segreti. L'apertura richiede comunque controllo manuale di evento, testi
privacy, dati gruppi/referenti e smoke test production.
