# Cerimonia finale: PDF unico dalla vista capogruppo — 26 ottobre 2026

Nella scheda Cerimonia finale di `/dashboard/capogruppo/cerimonie?kind=closing`
è disponibile «Scarica tutti i biglietti in un unico PDF». Include tutti i
biglietti nominali assegnati nei settori e gruppi gestiti visibili nella vista,
indipendentemente da settore selezionato, ricerca e pagina corrente. Un biglietto
per pagina, con dimensioni e immagine identiche al PDF personale. Ordinamento
stabile per settore, nome e ID. Testi disponibili nelle sette lingue.

Il pulsante mostra la preparazione, impedisce richieste duplicate e segnala
errori senza scaricare file parziali. È disabilitato quando non ci sono biglietti;
la navigazione fuori dalla scheda annulla la richiesta. I download individuali
restano disponibili.

La nuova route privata `/dashboard/ceremonies/badges` autentica l'utente e
riutilizza `loadLeaderTickets` e `get_ceremony_leader_tickets`: evento corrente,
ruolo e scope canonici, snapshot con lock, nessun ID/nome/gruppo ricevuto dal
browser. Usa i nomi correnti delle iscrizioni attive e dei figli ancora presenti.
Solo nomine attive con posto, cerimonia finale validata e settori badge;
bozze, posti da abbinare, minori senza posto e soggetti fuori dallo scope non
producono pagine. Non viene applicato il filtro delle deleghe email: sono i
biglietti già consultabili dal capogruppo nel sito.

La generazione con PDFKit riusa il renderer delle immagini personali e invia
progressivamente il PDF con cache privata/no-store. Asset inclusi nel tracing
della route, runtime Node e durata massima 300 secondi. Le immagini mantengono
la qualità originale: file grandi sono possibili per gruppi numerosi.

Verifiche:

- 1.222 test applicativi passati; nuovi controlli di scope/proiezione, 1.005
  adulti più minore esplicito, esclusioni, ordine, immagini identiche,
  autenticazione, errori, annullamento e assenza di file parziale.
- TypeScript, lint mirato e build production in copia isolata passati.
  Il lint generale segnala i tre errori preesistenti di `any` in
  `tests/ceremony-navigation.test.mts` e due warning estranei alla modifica.
- Browser con componente e route reali, autenticazione e snapshot sintetici:
  320/390/1440px, PDF reale di 103 pagine anche con settore/ricerca selezionati,
  preparazione, 404/503, lista vuota e pulsante assente per l'inaugurazione.
  Nessun errore JavaScript o overflow orizzontale. PDF verificato con Poppler,
  immagini e screenshot ispezionati.
- Stress test reale del renderer: 1.005 pagine, 343.562.124 byte, circa 43
  secondi e picco RSS 199 MiB; stream completo fino a `%%EOF`.
- Durante lo sviluppo: nessuna prova con dati personali reali, scrittura
  operativa, email o migration. Modifiche preesistenti conservate.

Prova browser riproducibile: `tests/browser/closing-leader-download.mjs`, con
`PLAYWRIGHT_MODULE` diretto al modulo Playwright disponibile. Risultati locali
in `output/closing-leader-download/` (dati sintetici).

## Rilascio richiesto

L’utente ha autorizzato commit e push su `main` e verifica della pubblicazione.
Il rilascio include soltanto il download unico, i test, il tracing degli asset
e questa documentazione; email visive e importazioni locali restano escluse.
Copia pulita preparata per Git: `npm ci` e 1.221 test passati (i 1.222 della
working copy comprendevano anche modifiche locali estranee). Confronto dello
SHA del deployment con il commit e controllo del dominio canonico dopo il rilascio.
