# Email con istruzioni di accesso

## Nuovi inserimenti

Dal 2026-09-11 il codice invia automaticamente una mail dopo il salvataggio
completo dell’iscrizione manuale con email personale. La scelta esplicita
«Voglio usare la mia email» non invia questa notifica né al partecipante né al
capogruppo. I recapiti non vengono copiati o modificati.

Gestione ruoli invia automaticamente le istruzioni in modalità **Nuovo utente**,
anche se il form non contiene `sendInvite`. In modalità **Utente esistente**
resta disponibile la scelta di inviare un avviso per il ruolo assegnato.
Anche la creazione di un capogruppo dalla gestione gruppi invia le istruzioni
dopo il salvataggio della membership. Modifiche successive e selezione di un
capogruppo esistente dalla gestione gruppi non inviano automaticamente email.

Il template `lib/email/account-access.ts` contiene testo e HTML con escape dei
dati. Per i partecipanti usa la lingua dell’iscrizione, con le sette traduzioni
e fallback inglese. Gli inviti ai ruoli sono italiani, come i precedenti inviti
operativi, con il ruolo leggibile e il riferimento a «La mia iscrizione».

La mail contiene il collegamento stabile alla home e queste istruzioni:

> Apri il sito e inserisci l’indirizzo email a cui hai ricevuto questo messaggio.
> Riceverai un link personale per accedere: non serve una password.

Spiega che la scheda è già presente e non occorre registrarsi di nuovo; per i
ruoli distingue l’area operativa dalla propria partecipazione personale.
Conserva le indicazioni spam/mittente sicuro. La mail iniziale non contiene
credenziali, token, QR o link di autenticazione a scadenza.

Per i partecipanti inseriti dal capogruppo il testo approvato cita l’Incontro
internazionale per la Pace «Pace disarmata e disarmante» ad Assisi. Il collegamento
segue subito l’introduzione; «Inserisci l’indirizzo email a cui hai ricevuto
questo messaggio…» compare dopo il collegamento, in testo e HTML e nelle sette
lingue. Il titolo e il luogo di questo template sono specifici dell’incontro
corrente e andranno aggiornati per eventi futuri.

Il flusso Auth resta quello esistente: per il partecipante inserito manualmente
non si crea un account al momento della notifica. Il primo Magic Link richiesto
dalla home crea l’utenza; la callback verificata collega la scheda per email.
L’account operativo viene creato/riutilizzato dal flusso ruoli esistente.

## Esiti e limiti

L’invio riusa SMTP e avviene solo dopo il successo delle scritture del flusso.
`sendAccountAccessEmail` registra `email.account_access_sent`, `_failed` o
`_simulated` in `audit_logs`, associando iscrizione/profilo, attore, evento,
hash dell’email, ruolo e versione del template. Non salva destinatario in
chiaro, contenuto del messaggio o errore SMTP grezzo nell’audit.
`sent` significa accettazione da parte del trasporto, non consegna in casella.

Un errore email conserva account/iscrizione/ruolo e mostra l’esito parziale:
non invita a ripetere la creazione. L’avviso al capogruppo è tradotto nelle
sette lingue. Il log `operational_user.role_assigned` usa `invite_requested`;
la consegna è registrata separatamente dopo il tentativo effettivo.

Non è introdotta una coda con retry automatici. Un’interruzione del processo
tra salvataggio e invio richiede riconciliazione; le scritture manuali restano
multiple come prima. Un errore nell’audit dopo l’accettazione SMTP viene
segnalato sul server senza ripetere l’invio. SMTP non garantisce idempotenza:
un eventuale recupero va verificato prima di reinviare. Nessuna migration,
modifica RLS o nuova dipendenza.

## Iscrizioni precedenti

Il comando seguente è esclusivamente di lettura e stampa soltanto conteggi:

```bash
node --env-file=.env.local scripts/preview-account-access.mts
# Oppure specificare esplicitamente l’evento:
node --env-file=.env.local scripts/preview-account-access.mts <event-id>
```

Non importa il trasporto email, non crea account e non supporta l’invio.
Seleziona `registrations.source = capogruppo`, esclude eliminate/annullate,
delega esplicita (anche con email aggiunta successivamente), email assenti,
ambigue, condivise o uguali a quella del creatore e notifiche già registrate.
Per i dati precedenti alla delega richiede `answers.contact.hasEmail = true`;
provenienza o creatore non verificabili richiedono revisione. Le letture sono
paginate e qualsiasi errore impedisce un risultato parziale.

Verifica in sola lettura del 2026-09-11 sull’evento corrente: **19 candidabili**,
5 eliminate/annullate, 4 delegate, 1 con provenienza da chiarire. Non è un
elenco congelato per l’invio: email, stato e precedenti consegne devono essere
riletti immediatamente prima di un eventuale invio storico autorizzato.
Nessun invio storico eseguito. Prima della pubblicazione del 2026-09-11 sono
state inviate, su richiesta esplicita, soltanto due email di prova a
`registrationspeace@santegidio.org`, con nomi sintetici e prefisso `[PROVA]`:
«La tua iscrizione è pronta» e «Il tuo accesso come Capogruppo». Entrambe
accettate dal server SMTP (250), usando template e trasporto dell’app con il
collegamento al dominio pubblico. Nessun account/iscrizione/ruolo creato per
queste prove. Controlli di rilascio: lint, TypeScript, 242 test e build riusciti;
fixture browser desktop/mobile verificata durante l’implementazione.

## Verifiche

`tests/account-access.test.mts` verifica template, selezione storica e
paginazione, errori SMTP/audit e azioni con scritture simulate. Include
capogruppo manuale e creazione ruolo dalla gestione gruppi.
`tests/operational-role-assignment.test.mts` verifica invio obbligatorio per
nuovi utenti, facoltativo per esistenti, destinatario server e assenza di invio
su scritture fallite. La fixture `tests/browser/operational-role-assignment.mjs`
verifica il form desktop/mobile, usando soltanto dati sintetici.
