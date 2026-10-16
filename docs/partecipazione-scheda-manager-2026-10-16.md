# Partecipazione nella scheda del partecipante — 16 ottobre 2026

## Richiesta e comportamento

La scheda aperta dal nome usa ora la stessa rimozione esplicita dell’Accoglienza:
Rimuovi presenza oppure Rimuovi presenze selezionate, rilettura dello stato e
conferma con i nomi. Deselezionare una persona non annulla la sua presenza.
Adulto e minori restano selezionabili separatamente; la rimozione interessa
soltanto le persone selezionate ancora presenti. Mantieni presenze annulla
l’operazione. La riga della tabella si aggiorna dopo il salvataggio.

Nella dashboard Manager la scheda espone Conferma partecipazione e Stampa
etichetta QR, come due azioni distinte. Su chiarimento esplicito dell’utente,
anche il solo ruolo Manager dell’evento corrente può usarle, limitatamente
alla singola iscrizione e ai minori associati. Restano le esclusioni per
iscrizioni non operative, eliminate o di altri eventi. Viewer esclusi.

Il nuovo permesso non apre scanner, gruppi, badge, cerimonie o incarichi.
Stampa senza presenza implicita, presenza senza stampa, contatori canonici,
revisioni, audit, retry idempotente e protezione degli esiti incerti conservati.
Il QR del genitore resta condiviso con i minori senza duplicare l’etichetta.

## Autorizzazione e migration

Le nuove Server Action sono legate all’ID dell’iscrizione. Il server verifica
sessione, evento corrente, ruolo e forma del comando a ogni operazione.
Il database rilegge il ruolo e lega codice pubblico e iscrizione prima di
qualsiasi lettura o scrittura. La stampa accetta solo la singola iscrizione.

La migration `20261016200000_manager_participant_reception.sql` introduce
due RPC dedicate, accessibili solo a service_role, e una verifica del ruolo
limitata a questa superficie. Le implementazioni canoniche sono condivise in
funzioni interne; le RPC scanner/stampa preesistenti conservano il gate
Admin/Accoglienza. Nessuna modifica alle policy RLS o ai dati applicativi.

Alla successiva richiesta di commit e push su main, la migration è stata
applicata e registrata atomicamente in produzione prima del rilascio del codice:
anche la scheda Admin utilizza le nuove RPC. Backup custom completo verificato
con `pg_restore --list`, permessi 600:

- Backup server: `/tmp/iscrizioni-pace-production-before-manager-participant-20261016-1792160497875.dump`.
- SHA-256 backup: `f1cfb25dc83c13ee2087c564d128bf0e3c23c4993b489eb5ba79a0bdcc6ebe31`.
- SHA-256 migration: `df6e578bd274a8d9a403b03ef14f335e0a5dfb162a9d2d9e4637e57a58a93560`.
- Confrontate 63 tabelle pubbliche, 88.248 righe: valori invariati.
- Confrontate 2.501 voci preesistenti di catalogo: solo due corpi funzione
  sostituiti e cinque funzioni aggiunte. Privilegi preesistenti, RLS, vincoli e
  altre funzioni invariati. Corpi canonici trasferiti verificati esattamente,
  salvo il nuovo gate circoscritto. Nuove funzioni service-only verificate.
- Modalità internal, catalogo Forum pubblico e coda vuoti conservati.

Staging invariato. Commit e push su main richiesti dall’utente; le modifiche
parallele ai verbali hardware sono escluse e conservate sul disco.

## Verifiche

- 906 test applicativi superati; lint, TypeScript e build production Webpack
  con npm ci in copia pulita superati.
- Browser sintetico della scheda: rimozione singola e del minore lasciando
  presente l’adulto, annulla/conferma, selezione, doppio clic, aggiornamento
  della riga, errori e controlli d’identità.
- Browser nella tabella Manager originale con Server Action originali e
  PostgreSQL temporaneo: solo Manager, Admin nella dashboard Manager, Viewer,
  apertura dal nome, stampa indipendente, conferma/rimozione, aggiornamento
  tabella, download PNG, desktop/mobile e revoca prima dell’operazione.
- Regressioni browser scanner USB e modalità telefono superate.
- SQL: permessi, identità iscrizione/codice, minori, esclusioni, revisioni,
  replay, stampa indipendente e revoca. Riprova dei gate Accoglienza esistenti.
  Rimozioni concorrenti da scheda Manager e scanner Admin producono un solo
  salvataggio e un conflitto. Valori di tutte le tabelle pubbliche invariati
  prima/dopo la migration sul database sintetico.

Il browser Manager usa una pagina contenitore di collaudo, un adattatore locale
Auth/PostgREST e una preview PNG sintetica; tabella, controlli, Server Action e
logica SQL sono quelli applicativi. Il test non certifica un login production.
Stampa simulata; nessuna email, stampa fisica o modifica di dati applicativi reali.

## QR su richiesta: prompt consegnato, implementazione successiva

L’utente ha chiesto un prompt per rinviare visualizzazione e caricamento del QR
al clic su un pulsante interno alla scheda Manager. Il caricamento automatico
della preview rimane invariato in questa tranche. Il prompt richiede Mostra QR,
assenza di richieste/rendering anticipati, download e stampa su richiesta,
gestione del cambio persona e mantenimento dei permessi.
