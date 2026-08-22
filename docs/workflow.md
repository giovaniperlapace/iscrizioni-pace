# Workflow operativo

Questa guida fissa il ciclo minimo da usare per ogni milestone finché non esisteranno runbook più specifici.

## Prima di iniziare

Per il lavoro da più postazioni seguire prima
`docs/lavorare-da-piu-computer.md`. Il repository attivo deve essere un clone
locale fuori da OneDrive, Dropbox o iCloud; GitHub è l'unico canale di
sincronizzazione del codice.

Nell'app Codex l'hook di progetto esegue automaticamente fetch e fast-forward
sicuro all'avvio. Da terminale sono disponibili:

```bash
npm run work:start -- nome-lavoro
npm run work:resume -- codex/nome-lavoro
npm run work:status
```

Eseguire sempre:

```bash
pwd
git status --short
git branch --show-current
```

Usare `git remote -v` quando serve verificare il collegamento a GitHub.

Se la working tree e' sporca, leggere il diff prima di modificare file. Le modifiche non comprese vanno trattate come lavoro dell'utente e non vanno sovrascritte.

## Branch

`main` resta pulito e aggiornato. Il lavoro ordinario avviene su branch brevi
`codex/*`, creati dall'ultimo `origin/main`:

```bash
git switch main
git pull --ff-only
git switch -c codex/nome-lavoro origin/main
```

Le prove si fanno sul branch. Quando tutto funziona e l'utente autorizza commit
e push, pubblicare il branch e aprire una pull request verso `main`.

Non fare push diretto su `main`. Non creare branch staging/produzione o branch
milestone salvo richiesta esplicita.

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

Per una chiusura assistita e sincronizzata del branch:

```bash
npm run work:finish -- "Descrizione chiara della modifica"
```

Usare `npm run work:finish:full -- "Descrizione"` quando serve includere anche
la build. I comandi si fermano se rilevano divergenze, posizione cloud, branch
non conforme o file potenzialmente segreti.

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
