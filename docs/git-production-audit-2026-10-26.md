# Salvataggio completo Git e audit produzione — 26 ottobre 2026

## Richiesta e perimetro

L'utente ha chiesto commit/push di tutto il lavoro locale e verifica che rilasci
precedenti da copie locali non siano stati persi dai successivi rilasci Git.
Compresi codice, migration preparate, test, script e documentazione. Credenziali,
dipendenze, build e artefatti temporanei restano esclusi secondo `.gitignore`.
Gli stash storici restano conservati: non vengono riapplicati sopra le versioni
correnti. Non costituiscono una coda di modifiche da pubblicare automaticamente.

## Evidenze dell'audit

Esaminati i 20 deployment più recenti e scaricati gli alberi completi dei sorgenti
per tutti e cinque i deployment manuali del 26 ottobre (l'API MCP li troncava;
la CLI autenticata ha restituito gli alberi completi). Confronto SHA-1 dei
contenuti con i commit Git di base, senza utilizzare i soli messaggi di commit.

| Deployment manuale | Confronto |
| --- | --- |
| `dpl_FwM7a5S16CaCMNsm7buoq6xoHwiA` | renderer piantina e lockfile diversi da `42d4ab8` |
| `dpl_92hWjtexaw912dKyZ23RaKANWaQc` | renderer piantina e lockfile diversi da `42d4ab8` |
| `dpl_8JnBixSd9S4YhgnL5CPg7KRzB1tY` | renderer, nuova geometria/test e lockfile |
| `dpl_AZpb9FznpaonQeHLmJKmw9kJ4PHD` | renderer, nuova geometria/test e lockfile |
| `dpl_Gycyk5m9mSTfnqvqKXJRYATsZLcS` | ripristino: renderer, geometria/test e lockfile sopra `95d20d1` |

Per l'ultimo layout prima dei badge sono stati confrontati 1.351 file sorgente.
Le sole aggiunte estranee all'applicazione erano file generati da Next/TypeScript
e un PDF sintetico temporaneo. Nessun modulo promemoria Forum era incluso in
questi rilasci: era preparazione locale non pubblicata, non una funzionalità
rimossa dalla produzione.

**Il problema della piantina era realmente accaduto:** `95d20d1` aveva escluso il
renderer locale. Il successivo ripristino manuale ha sorgenti applicativi identici
al commit `e65fb37`, antenato dell'attuale main. Il lockfile ripristinato coincide
ancora con quello attuale. Nessun'altra funzionalità applicativa diversa dal
commit di base emerge dai cinque alberi esaminati.

I commit `e65fb37`, `bb354e5`, `8a2ee7f`, `ee8029f`, `839b692` sono tutti antenati
del main corrente: piantina recuperata e sua successiva sostituzione autorizzata
con tre settori, badge personali, PDF dei delegati, testo approvato e filtro
campagne sono conservati. La modifica del layout a tre settori è intenzionale,
non una regressione al vecchio layout.

Questo controllo riguarda i deployment elencati del 25–26 ottobre e i sorgenti
locali correnti; non afferma che ogni deployment storico dell'intero progetto
sia stato confrontato. Gli stash precedenti restano recuperabili e invariati.

## Integrazione Forum senza attivazione

Salvati tutti i file locali dei promemoria Forum. La migration `20261026120000`
è versionata ma **non applicata**. Lettura production conferma tabella di
configurazione assente (`PGRST205`). Una guardia nel cron evita chiamate alle RPC
non installate e mantiene inattivi promemoria/report anche con tabella presente
ma senza eventi abilitati. Errori di rete e permessi non sono mascherati.
Le code campagne, lista d'attesa, scuole e cerimonie restano indipendenti.

Nessuna email reale, nessuna migration remota e nessun cambio di configurazione.
Le notifiche automatiche della cerimonia finale restano disattivate.

## Verifiche e backup

- 1.215 test applicativi, TypeScript e lint mirato passati.
- PostgreSQL temporaneo: tutte le migration canoniche, scenari promemoria e
  tre prove con dodici claim concorrenti, senza duplicazioni.
- Postmark `POSTMARK_API_TEST`: personale, collegata, riepilogo di 1.005 persone
  e report accettati, nessuna consegna reale.
- Test cron con promemoria abilitati/disabilitati, autenticazione preventiva,
  guasto di una coda isolato, configurazione mancante distinta da rete/permessi.

Backup completo prima del rilascio, lista e decodifica `pg_restore` verificate,
32.056.701 byte, permessi privati sul server:
`/root/backups/iscrizioni-pace/production-before-complete-git-snapshot-1793045792572.dump`.
SHA-256: `edde9dc78640cd01287381996f743ecf40065d83a1b72efa71b832089add64b8`.

Copia pulita dell'intero snapshot da `npm ci`: **1.215 test**, TypeScript e build
production passati. Nessun file applicativo rimosso nei cinque deployment
manuali rispetto al rispettivo commit di base. Aggiunta in AGENTS.md la regola
operativa: sorgenti versionati e push prima del rilascio, SHA del deployment
confrontato con il commit atteso.
