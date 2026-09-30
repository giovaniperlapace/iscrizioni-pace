# Guida pratica — collaudo su telefono e QR

Procedura riutilizzabile, preparata il 24 settembre 2026.
Aggiornamento 30 settembre: rilettura automatica dopo rimozione del QR,
nel rilascio panel autorizzato per lo staging. Le caselle sono da
compilare durante le prove: questo documento non certifica test già eseguiti.
Prima sessione: circa 20–30 minuti; prove approfondite in una sessione separata.

## 1. Prepariamo il tavolo

- Un telefono per l’operatore e un computer o secondo telefono per mostrare i QR.
- Per il collaudo completo: almeno un iPhone con Safari e un Android con Chrome.
- Connessione disponibile, batteria sufficiente e qualche stampa dei QR di prova.
- Una persona esegue; l’altra legge i passaggi e annota gli esiti.

Usiamo esclusivamente **staging e persone fittizie**: leggere il QR di un singolo
registra subito il suo ingresso, senza un secondo pulsante di conferma.

Aprire nel browser del telefono la [dashboard Accoglienza di staging](https://iscrizioni-pace-git-codex-pan-f98a13-giovaniperlapaces-projects.vercel.app/dashboard/accoglienza).
È l’alias documentato per la preview panel; chi prepara la sessione deve
confermare che esponga la versione da collaudare. Usare il browser direttamente,
evitando il browser interno delle app di messaggistica.

**Da predisporre prima di iniziare, con chi gestisce lo staging:**

- Accesso di test con ruolo **Accoglienza nell’evento corrente** oppure **Admin
  globale**. Il solo ruolo Manager indirizza alla dashboard Manager.
- Accesso aperto nello stesso browser che useremo per scansionare. Le email
  staging sono documentate in modalità log: non aspettare un Magic Link nella
  posta senza aver concordato la procedura di accesso di test.
- Versione della preview, evento e stato iniziale dei campioni annotati.
- QR validi generati dallo staging per i campioni seguenti. Un QR inventato o
  un QR production non sostituisce un campione valido.

| Campione | Preparazione | Stato iniziale |
| --- | --- | --- |
| A — Singolo | Un adulto, QR e codice partecipante | Mai entrato |
| B — Altro singolo | Identità diversa da A, QR e codice | Mai entrato |
| F — Famiglia | Un adulto e due minori fittizi, QR condiviso e codice | Tutti assenti |
| S — Scuola | Classe fittizia con 10 studenti e 2 accompagnatori prenotati, QR | Nessun ingresso |
| X — Non valido | QR di test revocato/scaduto, preparato dal referente | Deve essere rifiutato |

Preparare i QR individuali dall’area personale o dalla scheda capogruppo; per
la scuola usare il QR della prenotazione nella dashboard docente. Tenere le
immagini su un secondo schermo, una alla volta. Il codice partecipante di
quattro caratteri serve ai partecipanti; la scuola usa il QR o il suo contenuto.
Non inserire token o link di accesso nei verbali o nel repository.

## 2. Prima prova guidata sul telefono

Eseguire nell’ordine. Per ogni punto segnare **OK**, **KO** oppure **Non eseguito**.
Se i campioni sono già stati utilizzati, annotare le presenze iniziali: una
seconda sessione non può dimostrare il primo ingresso con persone già presenti.

### T01 — Aprire e avviare

1. Accedere alla dashboard e controllare l’evento.
2. Verificare il titolo **Registra ingresso evento** e l’incarico Accoglienza evento.
3. Toccare **Avvia fotocamera** e consentire l’accesso alla fotocamera.
4. Inquadrare inizialmente il tavolo, senza QR.

**Atteso:** anteprima visibile, preferibilmente dalla fotocamera posteriore;
nessun ingresso finché non si legge un codice. Il titolo resta riconoscibile
anche scorrendo la pagina. Non serve aprire l’app Fotocamera del telefono.

### T02 — Primo QR e protezione dalle letture ripetute

1. Mostrare A sull’altro schermo, con il QR intero e il bordo bianco visibili.
2. Partire a circa 20–30 cm e avvicinare/allontanare lentamente se necessario.
3. Attendere l’esito e controllare nome, codice e presenza registrata.
4. Tenere A fermo nell’inquadratura per altri 5 secondi; allontanarlo e rimetterlo.
5. Inquadrare B.

**Atteso:** A entra automaticamente dopo la risposta del server. Lo stesso QR
non avvia operazioni ripetute finché resta inquadrato o scompare solo brevemente. B viene elaborato senza
dover scegliere di nuovo l’azione. Nessun successo mentre il salvataggio è in corso.

### T03 — Persona già presente

1. Dopo B, inquadrare nuovamente A.
2. Annotare lo stato e l’ora della presenza.
3. Per ripetere A toglierlo dall’inquadratura per almeno un secondo, poi
   inquadrarlo di nuovo.

**Atteso:** presenza già registrata, nessun nuovo ingresso né cambiamento
dell’ora originale. La rilettura verifica lo stato senza modificare ingressi già registrati.

### T04 — Famiglia che arriva in due momenti

1. Inquadrare F: controllare i tre nomi e che nessuno sia selezionato.
2. Selezionare solo l’adulto e il primo minore, poi **Registra ingresso**.
3. Controllare che il secondo minore risulti ancora senza ingresso.
4. Togliere il QR dall’inquadratura per almeno un secondo e inquadrarlo di nuovo.
5. Verificare che adulto e primo minore siano indicati come già presenti e non
   selezionabili; selezionare solo il secondo minore e registrare.

**Atteso:** prima risultano presenti due persone, poi tutte e tre. Il secondo
ingresso conserva le presenze precedenti anche se non vengono riselezionate.

### T05 — Scuola con quantità effettive

1. Inquadrare S; verificare classe e quantità previste: 10 + 2.
2. Provare 11 studenti: il salvataggio deve essere impedito. Provare anche 0 + 0.
3. Inserire **8 studenti e 1 accompagnatore**, poi registrare.
4. Togliere S dall’inquadratura per almeno un secondo e inquadrarlo di nuovo.

**Atteso:** solo 8 + 1 registrati; una rilettura mostra l’ingresso esistente e
non sostituisce le quantità. Per cambiarle bisogna usare Correzioni.

### T06 — Codice non valido e alternativa manuale

1. Inquadrare X dopo un esito valido.
2. Verificare il rifiuto e che non restino in vista i dati della persona precedente.
3. Toccare **Inserisci il codice manualmente**, lasciare **Codice partecipante**, inserire il
   codice di A e premere **Leggi codice e registra**.
4. Tornare a **Inquadra QR code** e avviarla.

**Atteso:** nessun ingresso per X; A risulta già presente. L’incarico resta
ingresso evento. Anche la lettura manuale di un singolo assente registrerebbe
subito l’ingresso: non è una ricerca in sola lettura.

### T07 — Correggere e annullare consapevolmente

1. Aprire **Correzioni e annullamenti** e scegliere **Correggi presenze**.
2. Inserire il codice di F e premere **Verifica codice**.
3. Lasciare selezionati adulto e primo minore, togliere il secondo minore.
4. Verificare che il salvataggio richieda la casella di conferma; confermare e salvare.
5. Verificare di nuovo F: solo adulto e primo minore devono risultare presenti.
6. Chiudere la selezione con **Chiudi senza modifiche**. Scegliere
   **Annulla ingresso**, verificare F e selezionare soltanto il primo minore.
7. Confermare e annullare, poi verificare ancora F.
8. Chiudere senza modifiche e premere **Torna agli ingressi**.

**Atteso:** alla fine solo l’adulto è presente. Correggere sostituisce l’insieme
dei presenti; annullare riguarda solo i selezionati. Per annullare tutti usare
Annulla ingresso selezionando i presenti, non una correzione con selezione vuota.

## 3. Fotocamera nell’uso reale

Ripetere queste prove sui due telefoni. Con un QR già letto, toglierlo dall’inquadratura per almeno un secondo
oppure alternare A e B, altrimenti il blocco delle ripetizioni
può sembrare un problema di messa a fuoco.

| ID | Cosa fare | Cosa ci aspettiamo |
| --- | --- | --- |
| T08 | Ferma fotocamera → Avvia fotocamera | Anteprima ripristinata; stesso QR ancora protetto dalle ripetizioni |
| T09 | Ferma e riavvia la fotocamera dopo una lettura | Posteriore preferita a ogni avvio, nessun selettore anteriore, azione conservata |
| T10 | Passa a un’altra app o blocca lo schermo; poi torna | Camera sospesa; ripartenza con avvio esplicito |
| T11 | Esci dalla dashboard | Indicatore della fotocamera del sistema si spegne |
| T12 | Con permesso camera reimpostato, nega la richiesta | Errore comprensibile; Codice manuale utilizzabile |
| T13 | Riabilita il permesso nelle impostazioni del sito/browser e riprova | Scanner nuovamente utilizzabile; annotare se è servita una ricarica |
| T14 | Prova luce normale/scarsa, riflessi, QR più piccolo/grande e luminosità diversa dell’altro schermo | Annotare tempo e tentativi di lettura; riportare le condizioni dei fallimenti |
| T15 | Ripeti A e B su carta, poi con telefono in verticale/orizzontale | Identità corrette, pulsanti raggiungibili e testo leggibile |

Per reimpostare il permesso o ricaricare scegliere un momento senza operazioni
in corso o esiti incerti. I nomi dei menu dei permessi variano tra dispositivi.

## 4. Prove approfondite con il referente tecnico

### T16 — Rete interrotta durante il salvataggio

Usare F in correzione: verificare prima il codice, preparare una modifica,
confermarla e interrompere la rete mentre viene inviata. Per togliere davvero
la connessione disattivare sia Wi-Fi sia dati mobili. Se il salvataggio è già
finito, annotare che l’interruzione durante l’invio non è stata riprodotta.

**Atteso:** in caso di risposta persa o attesa oltre circa 20 secondi compare
un esito da verificare, senza falso successo; scanner e campi restano bloccati.
Ripristinare la rete e premere **Riprova la stessa operazione**. Il referente
controlla che sia stata eseguita una sola modifica, anche se il primo invio
era già arrivato al server.

**Non ricaricare o chiudere la scheda durante l’esito incerto:** il comando
da riprovare resta solo nella memoria della pagina. Se la scheda viene chiusa,
rientrare nel percorso Correzioni e verificare lo stato prima di agire;
la normale scansione di ingresso può già scrivere una presenza.

### T17 — Due operatori sulla stessa famiglia

Aprire la correzione di F su entrambi i telefoni e verificare il codice prima
di salvare su uno dei due. Salvare sul primo, poi tentare una modifica diversa
sul secondo con la vecchia verifica.

**Atteso:** il secondo rileva un conflitto e richiede una nuova verifica;
non sovrascrive silenziosamente la prima correzione.

### T18 — Revoca dell’incarico

Usare un account di prova con il solo ruolo Accoglienza, senza Admin globale.
Dopo una lettura valida, il referente rimuove l’incarico staging; inquadrare
un altro QR. Predisporre un secondo account admin per ripristinare l’incarico.

**Atteso:** nessun nuovo ingresso, flusso bloccato e ritorno all’accesso.
Provare anche una sessione scaduta quando riproducibile con il referente.

Il referente verifica presenze, assenza di duplicati e audit dei casi critici.
Le statistiche delle presenze effettive previste in P13 non sono il riscontro
per chiudere P12. Per rileggere senza registrare usare **Correzioni → Verifica
codice → Chiudi senza modifiche**. Per S selezionare Contenuto del QR.

## 5. Conserviamo il metodo per la stampa

**Già oggi:** stampare i PNG staging e ripetere T02–T06/T15 verifica la lettura
su carta. Nei PNG individuali scaricati controllare anche nome completo e
codice partecipante. Questa prova non certifica l’integrazione con le stampanti.

**Quando saranno disponibili P14/P15**, usare la stessa scheda risultati e
aggiungere i casi seguenti. Al momento sono prove future, non funzioni dichiarate disponibili.

| ID | Prova | Esito atteso |
| --- | --- | --- |
| ST01 | Annotare stampante, collegamento, driver, postazione/browser, formato in mm, DPI e scala di stampa | Configurazione ripetibile |
| ST02 | Stampare QR con nome lungo/accenti e codice pubblico | Nessun taglio, testo leggibile, QR intero con bordo bianco |
| ST03 | Produrre almeno 30 etichette consecutive, numerate nel verbale; leggerle tutte con i telefoni previsti | Nessuno scambio di identità; annotati tempi, inceppamenti e mancate letture |
| ST04 | Ristampare la stessa persona | Stesso QR attivo, originale e ristampa ancora leggibili, nessun nuovo ingresso dovuto alla sola stampa |
| ST05 | Terminare carta, scollegare stampante, bloccare e ripristinare coda | Problema riconoscibile, recupero controllato senza copie inattese |
| ST06 | Ingresso → stampa → lettura del badge, anche da ricerca manuale e con due operatori | Badge della persona corretta; nessuna confusione fra postazioni |
| ST07 | Confrontare stampa manuale e automatica, quando implementata | Automatica soltanto se abilitata esplicitamente sulla postazione |
| ST08 | Stampante indisponibile | Procedura alternativa documentata e praticabile |

Un'anteprima o un comando inviato non dimostrano che l’etichetta sia uscita:
controllare sempre il supporto fisico. La stampa non deve rigenerare/revocare
il QR. Eventuali letture ai panel si proveranno dopo l’implementazione dei
relativi incarichi, distinti dall’ingresso evento.

## 6. Scheda da copiare per ogni sessione

Conservare i verbali in `docs/collaudi/AAAA-MM-GG-descrizione.md`, creando la
cartella alla prima sessione. Usare gli stessi ID per confrontare versioni
successive e aggiungere nuovi casi senza cancellare gli esiti precedenti.

```text
Data e ora:
Chi esegue / chi annota:
Funzione e versione/commit della preview:
URL staging ed evento:
Telefono, sistema operativo e versione:
Browser e versione:
Ruolo di test:
Rete (Wi-Fi/dati mobili):
Campioni e stato iniziale:
Supporto QR (schermo/carta/etichetta), dimensione e luce:
Stampante/configurazione, se pertinente:

ID prova:
Esito: OK / KO / Non eseguito / Bloccato
Passi realmente eseguiti:
Risultato atteso:
Risultato osservato e messaggio esatto:
Tempo indicativo e numero tentativi:
Ripetibile? Quante volte?
Evidenza (solo dati fittizi, senza token/link di accesso):
Correzione necessaria e responsabile:
Nuova prova dopo correzione (data/versione/esito):

Stato finale dei campioni e incarichi ripristinati:
Prove ancora aperte:
Esito complessivo e chi lo conferma:
```

Non cancellare la storia dei check-in per ricominciare: usare annullamenti
espliciti per i campioni già provati o nuovi campioni per dimostrare un primo
ingresso. Un minore con storia di check-in non va eliminato o sostituito.

La prova rapida T01–T07 serve al primo riscontro. Per la chiusura del collaudo
P11/P12 servono anche due dispositivi reali, sessioni autenticate, QR a schermo
e stampati, prove T08–T18 con evidenze e riscontro tecnico dei casi critici.
Una prova non eseguita rimane aperta; un problema su identità, presenze duplicate,
conferme false o autorizzazioni blocca l’accettazione del flusso interessato.

Riferimenti tecnici: [P12](panel-p12-reception.md),
[P11](panel-p11-reception.md), [piano panel](../PIANO_DI_LAVORO_PANEL.md).
