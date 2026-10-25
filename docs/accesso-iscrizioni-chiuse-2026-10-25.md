# Accesso degli iscritti dopo la chiusura delle iscrizioni

## Diagnosi e correzione — 25 ottobre 2026

La lettura di produzione ha confermato l’evento corrente pubblicato con scadenza
`2026-10-24T23:59:59Z`, cioè il 25 ottobre alle 01:59:59 in Europe/Rome.
Il flusso email verificava la finestra di iscrizione prima di cercare l’accesso
esistente: la scadenza impediva quindi anche la richiesta del magic link.

`startPublicEmailFlow` ora risolve prima l’evento corrente tramite il lettore
operativo esistente e verifica l’accesso nell’evento. Iscrizioni attive, ruoli
e membership continuano a essere riconosciuti dalla funzione canonica esistente.
La finestra pubblica viene controllata soltanto per chi deve iscriversi; l’evento
pubblico deve coincidere con quello appena verificato. Le nuove iscrizioni
restano chiuse e il loro salvataggio conserva i controlli preesistenti.

Limiti di frequenza, cooldown, audit dell’invio e degli errori, destinazione
Forum validata e controlli successivi di autenticazione/autorizzazione invariati.
Nessuna migration, modifica dati o email reale di prova.

## Verifiche

- 1.132 test automatici superati, inclusi nove casi aggiunti al flusso email:
  accesso esistente a finestra chiusa/aperta, email senza accesso a finestra
  chiusa/aperta, evento assente e cambio dell’evento durante la richiesta.
  Invii e risposte dei lettori di accesso sono simulati.
- TypeScript e lint mirato su azione e test superati.
- Build production in copia isolata con dipendenze da `npm ci` superata.
- Nessuna modifica grafica; nessun invio reale a utenti per il collaudo.

Commit e push su `main`, con rilascio production automatico, autorizzati
esplicitamente dall’utente il 25 ottobre. Esito del deployment e verifica
del dominio riportati nella conversazione di rilascio.
