# Integrazione panel in main — 14 ottobre 2026

## Autorizzazione al rilascio e attivazione production

Successivamente alla preparazione locale descritta sotto, l’utente autorizza
commit, push e migration necessarie per pubblicare su main e consentire il
collaudo a distanza. Nuove funzioni solo Admin e nessuna apertura pubblica.
Questa decisione supera i precedenti divieti della tranche.

Applicate le otto migration panel mancanti e le due del 14 ottobre, con
registrazione nella stessa transazione e notifica PostgREST al commit.
La correzione dati `20260726120000` resta esclusa e non registrata.
Lo staging non è stato modificato da questo rilascio.

Backup custom completo verificato con pg_restore --list, permessi 600,
conservato sul server production:
`/tmp/iscrizioni-pace-production-before-admin-reception-20261014-1791970644888.dump`.
SHA-256 `1853b945497a903dda9e25aba1347c2d59e6e5f41fbbfb1a24df8be5a890270e`.

All’interno della transazione, prima e dopo le migration, confrontati conteggi
e impronte ordinate di tutte le colonne preesistenti delle 45 tabelle pubbliche:
83.960 righe invariate. Le colonne aggiunte non riscrivono i valori originali.
Confrontate con uno schema temporaneo delle sole migration 155 funzioni,
132 policy e 155 insiemi di privilegi. Conservati i permessi preesistenti,
i grant service_role predefiniti del server e la policy email citext
preesistente, che nessuna migration della tranche modifica. Il confronto
normalizza l’ordine dei privilegi; non importa funzioni ausiliarie dei test.
I tentativi di confronto preliminari non coincidenti sono stati interamente
annullati, senza registrare migration o modificare dati.

Controlli successivi senza scritture applicative: quattro identità Admin
ammesse al gate, dodici identità non Admin escluse; RPC scanner/etichette
service-only non eseguibili da anon/authenticated. Modalità `internal`,
catalogo pubblico vuoto. Nessuna scansione o stampa applicativa su dati reali,
nessuna email, account, incarico o sessione creati.

Build production e 21 regressioni mirate superate sul diff pubblicato;
restano valide le verifiche complete sotto. Merge `384f58a` su main,
con genitori `fced870` e `095af93`, pubblicato senza modificare branch panel
o quattro stash. Deployment Git production
`dpl_3DWzozwyFNcXhc2kZwhEnXxmfyN1` READY, alias del dominio reale assegnato
senza errori. Riscontro Vercel:
https://vercel.com/giovaniperlapaces-projects/iscrizioni-pace/3DWzozwyFNcXhc2kZwhEnXxmfyN1.

Verifiche sul dominio dopo il rilascio: home HTTP 200 con testo visibile
identico al precedente (esclusi script, stili e titolo HTML trasferito tramite
streaming); scuole pubbliche reindirizzate alla home. Percorsi Accoglienza,
collaudo Admin, stampa individuale, presenze e report reindirizzati al login
senza sessione. Sessione browser Manager esistente esclusa dalla pagina di
collaudo Admin, con ritorno alla propria dashboard. Nessun login creato o
ruolo assegnato per ottenere un controllo positivo. Il primo accesso Admin
alla pagina reale e il riscontro hardware restano affidati al collaudatore.
Ricerca runtime error/fatal sul nuovo deployment: nessun record restituito.

In caso di problema del codice, riportare il dominio al deployment precedente
`fced870`, lasciando inizialmente lo schema additivo. Il backup non va
ripristinato automaticamente sopra eventuali nuovi dati: ogni ripristino DB
richiede una verifica separata delle scritture successive.

## Richiesta e stato Git

L’utente cambia la destinazione dello sviluppo da panel a main, chiede di
integrare tutto il lavoro panel e di collaudare scanner/etichette solo Admin.
Rimane esclusa la pubblicazione automatica: niente commit/push, deployment,
migration remote, email o prove su dati reali.

Base main `fced870`, panel `095af93`, entrambi allineati ai rispettivi upstream
dopo fetch. Merge `--no-commit --no-ff`: cronologia panel preservata, conflitti
risolti senza scegliere interi file di un branch. Il merge resta da committare
solo dopo richiesta esplicita. Nessun branch o worktree nuovo.

Conservati i due stash preesistenti e aggiunti due stash nominati delle bozze
incomplete del continuo/coda, prima dei cambi di branch e del merge. Non sono
stati applicati con pop né cancellati. Il branch panel resta a `095af93`.

## Riconciliazione

- AGENTS e piano panel: entrambe le cronologie, con nuova decisione prevalente.
- Dashboard personale: intento Forum e download PNG autenticato di main,
  più codice cerimonie importato, accessibile nel pilot solo ad Admin.
- Scuole: nome Forum di main, provenienza della sottosezione, presenze evento
  e scheda operativa del panel, senza perdere filtri o ritorno alla pagina.
- Conservati home corrente, approvazione temporanea, prenotazioni future e
  controlli di modalità pubblica. Nessuna apertura del catalogo implicita.
- Scanner, QR gruppo, P11–P13 e cerimonie importati integralmente. Le nuove
  superfici operative sono riservate al collaudo Admin, con modello futuro
  conservato. Le funzioni panel P0–P10 già pubblicate per Manager rimangono.
- Output storici (screenshot, esportazioni, PDF/slide e artefatti operativi)
  conservati sul disco ed esclusi dal diff tramite ignore. Non ripubblicare
  dati/artefatti che main non versionava. Nessun profilo o credenziale aggiunto.

## Migration e inventario remoto in sola lettura

Due nuovi diff, non applicati remotamente:

- `20261014110000_admin_reception_pilot.sql`: gate Admin sulle basi
  transazionali dello scanner/gruppi e incarichi; RPC di readiness per non
  esporre uno scanner apparentemente pronto se il DB non è attivato.
- `20261014120000_qr_label_queue.sql`: estensione delle tabelle canoniche,
  manifesti invio, deduplicazione individuale/gruppo e stato fisico separato.

Inventario del 14 ottobre con sola transazione READ ONLY sul registro, senza
letture di nominativi né scritture applicative:

**Production: 11 versioni locali assenti dal registro**.

- Pregressa: `20260726120000_stop_unselected_group_auto_assignment.sql`.
  È una correzione dati storica, non un prerequisito dello scanner: esclusa
  da questa tranche e da qualsiasi applicazione automatica. Non applicarla
  né registrarla come eseguita senza una revisione separata.
- Otto importate dal panel:
  `20260912150000`, `20260922220000`, `20260930180000`, `20261006120000`,
  `20261006150000`, `20261006180000`, `20261006200000`, `20261006220000`.
- Le due nuove `20261014110000`, `20261014120000`.

**Staging: 12 versioni locali assenti dal registro**.

- Pregressa rinomina gruppi `20260813170000`.
- Cinque del 9 ottobre: `20261009120000`, `20261009140000`,
  `20261009150000`, `20261009160000`, `20261009170000`.
- Quattro del 10 ottobre: `20261010120000`, `20261010121000`,
  `20261010122000`, `20261010123000`.
- Le due nuove del 14 ottobre.

Questi conteggi non autorizzano SQL. Prima di un rilascio, backup verificato,
confronto delle definizioni attuali, dipendenze e piano di rollback; applicare
solo quanto revisionato/autorizzato. Non avviare l’app integrata in produzione
senza lo schema richiesto anche dalle viste operative importate.

## Verifiche

- Installazione dal lockfile; 847 test applicativi, lint, TypeScript e build staging.
- Tutte le migration su PostgreSQL 17 temporaneo, con regressioni del modello
  completo di ruoli/permessi, scanner, gruppi, badge e cerimonie; successiva
  applicazione del gate Admin e regressioni specifiche del pilot.
- Verificato anche l’aggiornamento tardivo main → migration panel, con base
  riproducibile `fced870`: coincidono tutte le 156 definizioni di funzione,
  132 policy e 156 insiemi di privilegi con la sequenza canonica completa.
- Concorrenza: richieste individuali/gruppo condividono l’unico tentativo;
  callback browser non conferma stampa; ristampa solo esplicita; identità/QR
  cambiati impediscono la conferma del vecchio contenuto.
- Elenco etichette oltre 1.000 iscrizioni verificato senza troncamenti; badge
  completo ancora separato e con proiezione delle sedute dopo la nuova coda.
- Browser con fixture sintetiche e stampa simulata: scanner desktop/mobile,
  famiglia/scuola, revoca e retry incerto; elenco etichette, esclusioni,
  documento multipagina, ristampa singola e pulizia iframe.
- Rendering PDF di quattro etichette: quattro pagine nominali 29 × 45 mm,
  con arrotondamento del motore PDF (circa 28,96 × 45,13 mm). Non è una misura
  fisica del supporto o del taglio. Nessun lavoro inviato a stampanti.
- La prova con account Admin reale sul DB aggiornato, le scansioni su staging
  e il collaudo fisico sul continuo restano separati e non dichiarati conclusi.

Procedura per l’altro operatore: [collaudo remoto](collaudo-stampa-remoto-admin.md).
