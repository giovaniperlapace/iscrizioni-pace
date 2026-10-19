# QR gruppo e stampa individuale nella stessa modale — 2026-10-19

## Richiesta e risultato

La gestione gruppi Admin/Manager usa un solo pulsante «QR del gruppo».
La modale separa il QR unico del gruppo (visualizzazione/download PNG invariato)
dalla sezione «QR dei partecipanti», con elenco nominale e stampa dei QR scelti.
Rimosso il precedente pulsante esterno «Stampa i QR del gruppo».
La selezione parte vuota; ogni persona può essere selezionata o deselezionata,
con selezione totale disponibile. QR non stampabili disabilitati con motivazione.
La stampa conserva selezione e contatori e non registra presenze.

L’utente ha autorizzato esplicitamente anche i Manager nell’evento corrente.
Capigruppo conservano la sola visualizzazione/download; scanner e conferme di
gruppo mantengono i propri permessi. La stampa riguarda il gruppo scelto,
senza includere i sottogruppi.

## Caricamento e controlli

QR, decodifica immagine ed elenco vengono preparati prima della visualizzazione.
Letture HTTP private/no-store su apertura e prima della stampa evitano navigazioni
per rinnovo cookie; le scritture usano le azioni canoniche. Chiusura bloccata
mentre la stampa è in corso; intestazione fissa e contenuto scorrevole.
Attesa iniziale limitata a 25 secondi, errori espliciti e recupero elenco senza
stampa implicita. Richieste iniziali annullate alla scadenza/smontaggio.

Migration `20261019200000_manager_group_qr_printing`: estensione del gate della
coda gruppo al Manager dell’evento corrente, mantenendo verifiche canoniche su
gruppo attivo, evento, appartenenza dei QR, snapshot, idempotenza, audit e outcome
dello stesso attore. Lettura ruoli a ogni operazione, revoche immediatamente
vincolanti. Nessuna nuova RPC pubblica o estensione ACL.

## Verifiche

- 965 test applicativi, lint, TypeScript e build production da npm ci superati.
- Suite PostgreSQL temporanea completa: migration senza variazioni ai dati,
  Manager/Admin/Accoglienza, esclusione Viewer/capogruppo, evento non corrente,
  gruppo inattivo/esterno, sottogruppi, selezione estranea, snapshot obsoleto,
  replay, outcome altrui, revoca ruolo; presenze e permessi scanner invariati.
- Browser sui componenti originali con dati sintetici: desktop/telefono,
  nessun precaricamento, preparazione congiunta, cookie rinnovato senza salto
  iniziale dello sfondo, selezione vuota e nominale, esclusioni, stampa simulata,
  blocco chiusura, selezione conservata, errore autorizzazione e recupero elenco.
  Regressioni QR/download byte identico, sette lingue esistenti, timeout e risposte
  tardive. Le nuove istruzioni di stampa usano l’italiano della gestione operativa.
- Nessuna stampa fisica, email o modifica a presenze reali. Prova autenticata
  con account reali non eseguita; percorso completo verificato sinteticamente.

## Rilascio

Backup custom produzione verificato tramite indice e decodifica completa:
`/root/backups/iscrizioni-pace/production-before-group-print-1792437215394.dump`,
12.563.312 byte, permessi 0600, SHA-256
`44877148846a50ef13493382a5316fb1e6c4a81f947eaa57686ada1b35fe96cd`.

Migration applicata e registrata atomicamente in production: 63 tabelle pubbliche,
129.765 righe invariate, 2.574 voci catalogo confrontate. Modificate soltanto le
due funzioni previste; ACL conservati, Forum internal e scuole attive. Un primo
controllo di fingerprint ha rilevato un errore di quoting nello script di verifica
prima della migration: transazione annullata integralmente, script corretto e
confronti superati nel successivo tentativo atomico.
