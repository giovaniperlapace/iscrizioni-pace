# Germania: provenienza e campi obbligatori

## Diagnosi del 24 settembre 2026

Letture paginate sull'evento corrente, senza modificare iscrizioni, account o
inviare email. Inclusi gli iscritti non eliminati assegnati al gruppo Germania
(e discendenti) o con paese di residenza Germania. Risultato al momento della
verifica: 23 iscrizioni, tutte `source=capogruppo`, con snapshot
`source=capogruppo_manual`. Nessuna delle 23 proviene dal modulo pubblico,
da un link di gruppo o dall'import Excel.

- 20 non hanno né `city_id` né `city_other`.
- 7 non hanno `birth_date`; tutte e 7 sono anche prive di città e la data manca
  anche negli snapshot originali. Sono state inserite il 23 settembre fra le
  10:42 e le 11:10, ora italiana, prima del commit della correzione nascita
  delle 11:36 (`683ee75`).
- Le 11 iscrizioni del 24 settembre hanno tutte la data e nessuna la città.
- Due ulteriori schede avevano la data vuota nello snapshot, ma ora la hanno:
  lo snapshot iniziale non sostituisce l'anagrafica corrente.

La mancanza è nei dati, non un effetto della traduzione tedesca o della tabella.
Il loader capogruppo legge `birth_date`, `city_other` e la relazione `cities`;
il mapper conserva questi valori. Il gruppo nazionale Germania non ha città
configurata. Il precedente inserimento manuale non chiedeva la residenza:
copiava `group.city_id`, quindi per questo gruppo salvava null.

Gli elementi identificativi e gli snapshot della diagnosi rimangono solo nel
percorso locale riservato `output/germany-required-fields-20260924/`, non nel
repository. Nessuna data o città storica viene dedotta dal gruppo o inventata.

## Correzione

- Campo città di residenza obbligatorio nel componente manuale condiviso da
  Capogruppo, Manager e Admin, nelle sette lingue (tedesco: Wohnort).
- Parser condiviso browser/server: città omessa, vuota, composta da soli spazi
  o oltre 120 caratteri respinta prima di Auth, scritture e invii. Errori
  localizzati, focus e valori conservati tramite ReliableForm.
- La città dichiarata viene salvata in `participants.city_other` e nello
  snapshot `answers.residence.cityOther`; `city_id` non viene dedotto dal
  gruppo. Sono ammesse città fuori catalogo e caratteri come Würzburg.
- Data di nascita continua a essere obbligatoria, reale e non futura.
- Pubblico e link di gruppo condividono già i controlli per entrambi i campi,
  indipendenti dalla lingua. Aggiunte regressioni anche per richieste senza
  campo e per la selezione Germania nella UI tedesca.
- Import Excel richiede la città anche nella conferma di anteprime create
  prima della correzione. Guida web e modello condividono le istruzioni.
- Nessuna migration, modifica RLS/ruoli, scrittura di collaudo reale o reinvio.
  La modifica riguarda le nuove iscrizioni; i dati storici vanno raccolti.

## Verifiche

Test parser e azione manuale reale con database sintetico: campi obbligatori,
assenza di effetti collaterali su input errati, città diversa da quella del
gruppo conservata per capogruppo, Manager e Admin, snapshot e invii invariati.
Regressioni Excel su anteprime precedenti e scarto motivato delle righe.
Fixture browser `tests/browser/required-registration-fields.mjs` con il
componente reale, azioni sintetiche, sette lingue e desktop/mobile.

Esito: 531 test, lint, TypeScript e build production superati in una copia
isolata con `npm ci` dal lockfile (Next 16.2.9). Browser manuale nelle sette
lingue per Capogruppo/Manager e pubblico/link in tedesco: blocchi, focus, dati
conservati e layout mobile superati, nessun errore browser. Le modifiche
parallele alla vista figli/statistiche non fanno parte della copia verificata.

Rilascio integrato con la vista Figli accompagnati autorizzato il 24 settembre
tramite commit/push su main. Verifica finale congiunta: 537 test, lint,
TypeScript e build con npm ci, browser Manager/Admin desktop/mobile con
scheda storica incompleta. Rilettura READ ONLY delle 23 iscrizioni: tutte
presenti e nessuna eliminata; dati mancanti conservati senza correzioni inventate.
