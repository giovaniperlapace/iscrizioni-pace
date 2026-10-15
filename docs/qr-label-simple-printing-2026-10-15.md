# Pulsanti etichette semplificati — 15 ottobre 2026

## Comportamento richiesto

L’operatore stampa dalla scheda della persona o dalla riga del gruppo senza
configurare carta/stampante e senza confermare fisicamente l’etichetta nel sito.
I testi rimangono **Stampa etichetta QR** e **Stampa i QR del gruppo**, anche
quando il pulsante è occupato o viene usato nuovamente.

- Singolo: un pulsante, lettura fresca dei dati e stampa del QR esistente.
- Gruppo: modale conservata, nomi/codici con check individuali, Seleziona tutte
  e quantità selezionata. Sono selezionati inizialmente tutti i QR disponibili,
  compresi quelli già richiesti in precedenza; l’operatore può deselezionarli.
- Rimossi scelta rotolo, conferma stampante, istruzioni di configurazione,
  Aggiorna elenco, stati di conferma e Conferma etichetta. La configurazione
  della postazione resta nella procedura tecnica, fuori dal flusso operativo.
- Continuo DK-22210, documento 29 × 45 mm. Altra carta rimane supportata dai
  renderer/strumenti tecnici, senza selettore nei pulsanti operativi.
- Un nuovo clic è una richiesta esplicita, anche per le copie già richieste.
  Il gruppo produce un solo documento multipagina per le persone selezionate.
  Nessuna ristampa automatica dopo conflitti o risposte incerte.

## Registro e controlli

La nuova azione `request` estende la RPC canonica. Accetta nello stesso lotto
etichette nuove e già richieste, con snapshot, lock e manifesto atomico. Stesso
record canonico per iscrizione/evento; ogni clic conserva il relativo tentativo.
L’audit preesistente continua a distinguere print/reprint per persona.

Nessuno stato viene automaticamente trasformato in verifica fisica: il ritorno
del browser resta browser_returned, indipendente da uscita e consegna. Gli
storici verified preesistenti e l’API verify sono conservati, ma il nuovo flusso
non li richiede né li invoca. Nessuna modifica a iscrizioni, token o presenze.
Admin globale, evento corrente, esclusione eliminati/annullati, QR attivo,
nominativi e capienze/autorizzazioni preesistenti restano conservati.

Il blocco del doppio clic copre l’intera pagina già durante le richieste server,
prima dell’iframe. Gli altri pulsanti etichette sono temporaneamente disabilitati.
La modale non viene chiusa durante il proprio tentativo. Escape e ritorno del
focus funzionano appena concluso. Ogni clic rilegge il gruppo; un QR divenuto
non disponibile aggiorna le selezioni e richiede un nuovo clic esplicito,
senza stampare un insieme diverso da quello scelto.

## Verifiche

- 886 test applicativi, lint completo, TypeScript e build production Turbopack
  in copia pulita senza credenziali superati.
- PostgreSQL temporaneo: nuova/precedente etichetta in un unico lotto,
  manifesto/audit, replay senza secondo documento, snapshot concorrenti,
  assenza di verifica automatica, impronte iscrizioni/QR/presenze invariate,
  privilegi anon/authenticated/service_role conservati e regressioni operative.
- Browser con print simulato: check, deselezione, stesso testo nelle ristampe,
  lotto misto, doppio clic e blocco tra pulsanti, recupero da errore, revoca QR
  tra scelta e clic, pulizia iframe e layout mobile. Nessun lavoro fisico inviato.
- Modale reale in copia isolata con PostgreSQL sintetico: selezione vuota,
  singola, riapertura, Escape/focus e desktop/mobile. Anteprima locale disponibile
  durante la sessione; non collegata ai dati production.

Le prove fisiche dal sito con il flusso precedente sono documentate in
[collaudo-dk22210-2026-10-15.md](collaudo-dk22210-2026-10-15.md).
Non attribuirle alla nuova interfaccia finché questa non è pubblicata.

## Rilascio

Migration additiva `20261015120000_simple_qr_label_printing.sql`. Modifica esclusivamente la funzione esistente,
senza nuove tabelle/colonne, cambi ai privilegi o correzioni di dati.
Applicare prima la migration e poi pubblicare il codice; i vecchi comandi
restano compatibili durante il passaggio. Il rollback del solo codice non
richiede cancellazione di tentativi o ripristino dei dati.

L’utente autorizza il 15 ottobre commit e push su main e la migration necessaria
in produzione. Migration applicata e registrata in un’unica transazione con
reload PostgREST; confrontate tutte le 63 tabelle pubbliche (86.142 righe) e
2.497 voci di catalogo: dati, policy, privilegi, colonne, vincoli, trigger e
funzioni estranee alla stampa invariati. Definizione della funzione confrontata
con le sole tre sostituzioni previste. Accesso alla RPC sempre service_role,
anon/authenticated esclusi, modalità internal e catalogo pubblico/coda vuoti.

Backup custom completo verificato con `pg_restore --list`, permessi 600, sul
server di produzione:
`/tmp/iscrizioni-pace-production-before-simple-qr-printing-20261015-1792059440130.dump`.
SHA-256 backup: `79f9d84b1ebb4c276bddcf404cdacce4f4ea86a98cc7e6c3e7d625fd08cea185`.
SHA-256 migration: `0aa50848dd074a4ca68436b87abe2394427fc224153675586f42d193b62fdfdb`.

Pubblicazione del codice tramite push su main e normale deployment Git Vercel.
Le modifiche scanner USB presenti contemporaneamente nel workspace sono escluse
da questo commit; il flusso telefono/postazione pubblicato resta invariato.
Staging escluso dal rilascio. Nessuna email, stampa fisica automatica o prova
che scriva dati reali eseguita per questa pubblicazione.

## Indicazione del numero di richieste

Su richiesta successiva dell’utente, accanto al pulsante individuale compare
**Stampe richieste: N**. La modale gruppo mostra lo stesso valore per ogni
persona, conservando i check. Il numero proviene da `attempts` del registro
canonico esistente, comune alla stampa singola e di gruppo. È letto anche
all’apertura del singolo e aggiornato con la risposta server dell’esito;
nessun polling e nessuna nuova migration. Durante la lettura compare `—`.

Il conteggio comprende tentativi già preparati anche quando la stampa genera
un errore: indica richieste, senza attestare uscita fisica o consegna.
Una lettura fallita non incrementa il numero. Le risposte iniziali tardive
non sovrascrivono il risultato di una richiesta più recente.

Verificati 893 test, lint mirato, TypeScript e build production pulita. Browser
sintetico desktop/mobile: storico iniziale, incremento dopo invio, ristampa,
lettura condivisa singolo/gruppo, riapertura, errori, selezione e assenza di
verifica automatica. Stampe simulate, nessun dato remoto modificato.
L’utente autorizza commit e push su main anche di questa aggiunta, con normale
deployment Git Vercel. Modifiche scanner USB escluse dal commit; nessuna
migration aggiuntiva necessaria.
