# Piano operativo ultima settimana prima dell’evento

Decisioni concordate il 19 ottobre 2026. Obiettivo: rendere pronti entro
l’inizio dell’evento QR gruppo, cerimonie, accessi Forum e statistiche.
Questo piano prevale sulle precedenti priorità e sui vecchi stati di collaudo
esplicitamente superati dalle decisioni riportate qui.

## Priorità di lavoro

Chiarimento del 19 ottobre, dopo la verifica delle cerimonie: rinviare soltanto
la definizione delle sedi reali e della loro disposizione, ancora sconosciute.
Proseguire il punto 2 per le altre funzioni, rendendole disponibili in production
per la revisione dell’utente. Nessuna capienza o piantina reale va inventata;
configurazioni definitive e assegnazioni operative attendono i dati delle sedi.
L’utente conferma accesso solo Admin per la revisione iniziale.

Su successiva richiesta, rivisti menù e workflow: navigazione comune alle tre
fasi, cerimonia conservata, istruzioni e prossimo passaggio espliciti, stati
vuoti con collegamenti alla preparazione. Verificati test, lint, TypeScript,
build pulita e browser sintetico desktop/mobile; regole e permessi invariati.
Dettagli in [cerimonie](panel-p13-ceremonies.md).

E1/E2/E3 sono già disponibili nel deployment production READY `a42994a`,
raggiungibili da Forum → Cerimonie. Verificati deployment e migration; rieseguite
le suite SQL locali, comprese assegnazioni, minori, piantine e concorrenza.
Production non contiene ancora configurazioni delle cerimonie. La revisione
autenticata Admin resta da svolgere: il browser disponibile è senza sessione.
Non serve un nuovo deployment per questa prima revisione. Il raccordo QR degli
operatori con incarichi cerimonia e gli eventuali ingressi dedicati restano da
completare e non sono inclusi nelle funzioni E1/E2/E3 già pubblicate.

1. **QR del gruppo, da affrontare subito.** Garantire stabilità anche nel
   database: il QR non deve poter essere revocato, cambiato o annullato.
   Verificare lo stato della migration `20261016160000_stable_group_qr` e la
   compatibilità con le funzioni successive prima del completamento DB.
   Aggiungere nella gestione gruppi della dashboard Manager un pulsante per
   visualizzare e scaricare il QR del gruppo, entro lo scope autorizzato.
   Accettazione: stesso QR alle letture successive, nessuna azione di gestione
   della credenziale e accesso Manager limitato ai gruppi consentiti.

2. **Inaugurazione e cerimonia finale.** Completare e rendere operative le
   funzioni sviluppate sul branch Panel e già integrate in main: settori,
   quote, assegnazioni nominali e piantine/posti numerati dove necessari.
   Configurare le due sedi indipendentemente con i dati reali disponibili,
   senza inventare capienze. Verificare consultazione di settore/posto tramite
   QR, permessi degli operatori e flussi Admin/Manager/capogruppo previsti.
   Accettazione: configurazioni e assegnazioni coerenti, indicazioni leggibili
   e accessi circoscritti, con revisione dell’utente prima dell’uso operativo.

3. **Accessi Forum e ruolo dedicato.** Completare e verificare scansione QR,
   controllo della prenotazione ed esito di ammissione o rifiuto. Il ruolo è
   dedicato esclusivamente all’accesso al Forum assegnato e alla consultazione
   delle indicazioni pertinenti, senza accesso alla gestione generale.
   Verificare anche la consultazione di settore/posto, quando previsto, per
   Forum e cerimonie con i rispettivi incarichi. Conservare la distinzione
   fra ingresso evento e ingresso Forum e verificare i permessi lato server/DB.
   Accettazione: operatore autorizzato sul proprio incarico, escluso dagli
   altri, con scansione ed esiti verificati prima dell’inizio dell’evento.

4. **Statistiche.** Verificare correttezza dei conteggi e leggibilità delle
   schermate, distinguendo iscritti, prenotati e presenze effettive. Rendere
   filtri, descrizioni e riepiloghi comprensibili e controllare la coerenza
   con le fonti canoniche e il perimetro autorizzato.

## Avanzamento QR gruppo — 19 ottobre

Implementazione Manager/Admin e verifiche tecniche completate. Su richiesta
esplicita, backup custom verificato e migration `20261016160000` e
`20261019120000_manager_group_qr_access` applicate/registrate atomicamente in
production: dati e permessi invariati, 47 QR conservati. Rilascio congiunto su
main completato: commit applicativo `7251f7d`, deployment production READY e
dominio ufficiale verificato. Il collaudo autenticato online resta da eseguire;
test sintetici e controlli DB/HTTP superati.
Dettagli e limiti in [verbale QR gruppo](qr-gruppo-manager-2026-10-19.md).

Su nuova richiesta, completata anche la visualizzazione congiunta della scheda
partecipante Manager/Admin dopo il caricamento iniziale, senza pulsante Mostra QR
aggiuntivo. Inclusa nel rilascio congiunto autorizzato; vedere il
[verbale scheda partecipante](scheda-partecipante-caricamento-2026-10-19.md).
Corretto anche il salto residuo segnalato dopo il rilascio: le letture iniziali
non navigano la dashboard in caso di rinnovo della sessione; nessuna migration.

## Apertura Forum al via libera

L’apertura non è subordinata alla conclusione delle priorità sopra: si procede
appena l’organizzazione comunica che i Forum sono pronti. Pubblicare catalogo
e funzioni collegate, incluse prenotazioni personali, capogruppo e lista
d’attesa, verificando i relativi percorsi. Conservare operativo il flusso
scuole già pubblicato. Fino al via libera non anticipare l’apertura generale.

## Metodo di lavoro e rilascio

- Da ora il lavoro procede direttamente su `main`, con rilascio e verifiche
  direttamente in production; non pianificare passaggi ordinari su branch
  Panel o staging.
- L’utente specificherà per ciascuna tranche se renderla disponibile soltanto
  agli Admin per il collaudo oppure ai Manager/operatori previsti, anche con
  l’aiuto di un piccolo gruppo di collaudatori. Non estendere implicitamente
  i permessi né confondere un rilascio riservato con l’apertura pubblica.
- Conservare controlli tecnici pertinenti, dati e modifiche locali preesistenti.
  Concordare nel caso concreto le prove che registrano ingressi, occupano
  posti o inviano comunicazioni; nessun invio reale implicito nel collaudo.
- Alla conclusione di ogni tranche aggiornare il relativo verbale e AGENTS.md
  con esito, destinatari del rilascio ed eventuali punti ancora aperti.

## Attività accettate ed escluse

- **Stampanti e stampa QR:** l’utente conferma che il test è andato bene.
  Considerate collaudate ai fini di questo piano; non riaprire automaticamente
  le vecchie liste di prove hardware ancora pendenti nei verbali storici.
- **Dashboard Accoglienza:** accettata dall’utente; intervenire su problemi
  concreti se emergeranno, senza una nuova revisione generale preventiva.
- **Accrediti stampa:** esclusi dal lavoro per questo evento, eventualmente
  da riprendere l’anno prossimo. Non avviare P13-S.
- Le altre voci dell’inventario precedente restano fuori da questa settimana
  salvo nuova richiesta, compreso il caricamento QR individuale su clic.
  Resta valida la decisione di non estendere ora il controllo di revisione
  alla conferma individuale delle presenze.

## Riferimenti

- [QR gruppo stabile](qr-gruppo-stabile-2026-10-16.md)
- [Cerimonie e assegnazioni](panel-p13-ceremonies.md)
- [Accessi Forum](panel-p13-access.md)
- [Lista d’attesa capogruppo](group-panel-waitlist-2026-10-17.md)
- [Rilascio del 17 ottobre e stato migration](rilascio-presenze-scuole-forum-2026-10-17.md)
