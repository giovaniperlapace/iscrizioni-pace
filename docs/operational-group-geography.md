# Paese e città nell’editor gruppi

23 settembre 2026 — rilascio autorizzato su main/Vercel; migration applicata in produzione.

## Comportamento

Manager e Admin possono collegare un territorio in **Gruppi → Nuovo gruppo** o
**Modifica → Territorio per i suggerimenti**:

- **Paese**: collega direttamente un paese; la scelta vuota usa il territorio del
  nodo superiore. Senza territorio diretto o ereditato, il gruppo non viene
  suggerito per paese. Il nome del gruppo non viene interpretato come territorio.
- **Città (facoltativa)**: elenco dipendente dal paese diretto o ereditato. Senza
  città esplicita resta quella eventualmente ereditata, altrimenti tutte le città
  del paese. Cambiare paese azzera la città selezionata.
- **Altra città**: consente di indicare una città assente dall’elenco. Viene
  inserita nel catalogo soltanto nel salvataggio riuscito. Nel modulo pubblico
  una città non presente nei suggerimenti statici resta inseribile con “Altro”.
- Il riepilogo mostra il territorio ereditato. Un paese in conflitto con gli
  antenati, una città appartenente a un altro paese o una modifica che rende
  incoerenti i sottogruppi vengono rifiutati senza salvare parzialmente.

Gli elenchi combinano il catalogo geografico e le opzioni del modulo pubblico.
Le identità esistenti prevalgono, evitando doppioni. Le voci inattive restano
visibili sulle schede che le utilizzano, ma non sono selezionabili per nuovi
collegamenti. I cataloghi sono paginati e caricati soltanto all’apertura
dell’editor; un errore impedisce di presentare un catalogo parziale.

Il matching pubblico resta invariato: gruppo attivo, pubblico e iscrivibile;
filtri di età; città riconosciuta prioritaria; fallback sul paese quando la città
non è riconosciuta. Un gruppo con una città non viene proposto per una diversa
città riconosciuta. Impostare il territorio non cambia tipo, visibilità o
iscrivibilità. Per i normali suggerimenti scegliere **Gruppo effettivo**.

## Salvataggio e permessi

`saveOperationsGroup` deriva l’attore dalla sessione. La RPC
`save_operational_group` è disponibile soltanto a `service_role` e verifica nel
DB Admin globale o Manager dello stesso evento; rifiuta viewer e capogruppo.
La lettura della scheda porta i collegamenti originali e `updated_at` al modulo.
Il confronto conserva la precisione del timestamp PostgreSQL: una scheda
obsoleta restituisce `PT409`, con richiesta di riapertura. Mancanza dei nuovi
campi o della versione in modifica non svuota i collegamenti.

La RPC salva gruppo, eventuali nuovi paesi/città e audit prima/dopo nella stessa
transazione. Riutilizza gli ID esistenti, mantiene l’ordine pubblico in modifica
e lo calcola nel DB in creazione. Un lock breve sulla tabella gruppi serializza
modifiche della gerarchia anche rispetto alle vecchie scritture dirette e alla
rimozione dei gruppi. RLS, ruoli, iscrizioni e assegnazioni non cambiano.

Il flusso dei referenti rimane separato dalla transazione dei gruppi. La
creazione di una nuova identità avviene soltanto dopo il salvataggio riuscito
del gruppo, così errori geografici o conflitti non modificano persone/account.
I collegamenti pubblici continuano a essere creati dai trigger esistenti.

## Rilascio

La migration `20260923180000_operational_group_geography.sql` è stata applicata
e registrata atomicamente in produzione il 23 settembre **prima** del push. Aggiunge
soltanto una RPC e relativi privilegi, senza riscrivere dati preesistenti. Verificare
che anon/authenticated non abbiano EXECUTE. La vecchia versione dell’app resta
compatibile con la migration. Non rimuovere la RPC finché la nuova app la usa.

Conteggi e impronte delle 15 tabelle operative e tutte le 89 policy verificati
invariati nella transazione. Privilegi solo service_role verificati. Prove di
attore non autorizzato e versione obsoleta terminate rispettivamente con 42501
e PT409 prima delle scritture; transazione di verifica annullata. Nessuna
scrittura di collaudo su gruppi/persone reali né email. Backup schema riservato
sul server in `/root/pace-release-20260923-group-geography/schema-before.sql`.
La precedente configurazione richiesta dei 12 gruppi nazionali è già operativa:
sei gruppi creati e sei conservati/collegati, con paese esplicito e senza città.

## Verifiche

- `tests/group-geography.test.mts`: cataloghi e traduzioni, ID esistenti,
  normalizzazione, paginazione e fail-closed, attore della sessione, permessi,
  conservazione versione/collegamenti, conflitti senza scritture alle identità.
- `tests/sql/operational-group-geography.sql`: PostgreSQL temporaneo, scope,
  città/paese, antenati, sottogruppi, ciclo, cataloghi inattivi, timestamp obsoleto,
  riuso del catalogo, rollback delle aggiunte in caso di errore e audit/grant.
  Verificati inoltre due salvataggi concorrenti: uno riesce, il secondo riceve
  conflitto obsoleto senza sovrascrivere il primo né creare deadlock.
  Eseguire con `psql -X -v ON_ERROR_STOP=1 -f tests/sql/operational-group-geography.sql`
  esclusivamente in un cluster PostgreSQL locale vuoto e usa e getta.
- `tests/browser/group-geography-fixture.tsx`: fixture locale, nessuna azione
  reale. Montare temporaneamente una pagina che ne esporti il default in una
  copia di collaudo, quindi rimuoverla. Verificati creazione, modifica, cambio
  paese/città, territorio ereditato, payload ed errore conservativo nelle sette
  lingue, desktop e 390 px, senza errori browser.
- Dipendenze installate con `npm ci` in copia pulita: 469 test, lint, TypeScript e
  build production superati. La directory originale contiene Next 16.3.0 mentre
  il progetto richiede 16.2.9, oltre a tipi `.next` obsoleti: non usarla come
  riferimento per il collaudo del rilascio.

## Estensione a più città — rilascio autorizzato il 23 settembre

Il form conserva la disposizione precedente **Paese → Città (facoltativa)**.
Dopo la prima scelta, **Aggiungi un’altra città** aggiunge un altro selettore;
le righe possono essere rimosse e ogni riga consente **Altra città**.
Non c’è un passaggio aggiuntivo per scegliere una modalità geografica.
La scelta vuota mantiene il territorio ereditato o tutto il paese, come prima;
se il padre ha città collegate, il primo selettore offre anche **Tutte le città
del paese** per interrompere esplicitamente quel vincolo ereditato.
Cambiare paese azzera l’elenco; selezionare l’opzione generale lo svuota.

Le città selezionate sono alternative: un gruppo Umbria collegato a Perugia,
Terni, Assisi e Foligno viene proposto per ciascuna. Una città riconosciuta
estranea viene esclusa; il fallback per città non riconosciuta resta quello
esistente. Visibilità, iscrivibilità, età e scelta volontaria del gruppo restano
invariate. I sottogruppi ereditano l’intero insieme dal più vicino antenato
valorizzato; una scelta diretta lo sostituisce, senza unire territori impliciti.

La migration `20260923210000_group_multiple_cities.sql` aggiunge `city_scope`
e `group_suggestion_cities`, con chiavi esterne e RLS di lettura subordinata
alla visibilità del gruppo. Scritture soltanto service_role tramite la RPC
esistente, che conserva scope, lock, versione e audit atomico e valida ogni città.
Una sola città resta in `groups.city_id`; con più città questo campo è nullo e
tutte le città sono nella relazione: l’inserimento assistito non attribuisce
arbitrariamente agli iscritti la prima città di un gruppo regionale.
La relazione si elimina col gruppo e impedisce di cancellare città collegate.
Nessuna riscrittura di persone o assegnazioni. Limite 100 città per gruppo;
deduplicazione su ID e nomi normalizzati; letture paginate anche della relazione.
Un vecchio editor non può cancellare silenziosamente una configurazione multipla.

Test: parser e azione, caricamento oltre 1.000 collegamenti, matching di ogni
città/ereditarietà/precedenza, SQL su PostgreSQL temporaneo con rollback e vecchio
contratto a città singola; fixture browser in sette lingue e mobile a 390 px.
Per il rilascio applicare e registrare la nuova migration **prima** del codice;
verificare privilegi, dati esistenti e backup come nel rilascio precedente.
La migration è stata applicata e registrata atomicamente in produzione prima
del push autorizzato. Conteggi/impronte delle 15 tabelle operative invariati
(confrontando sui gruppi le colonne preesistenti); le 89 policy e i grant delle
36 tabelle preesistenti sono invariati. Nessun collegamento multiplo aggiunto
a gruppi reali durante il rilascio. Verificati rifiuto di attore non autorizzato
e PT409 per versione obsoleta prima delle scritture. Backup schema riservato:
`/root/pace-release-20260923-multiple-cities/schema-before.sql`.

Verifica finale dell’estensione: 502 test, lint, TypeScript e build production
superati in copia pulita con dipendenze del lockfile. Browser nelle sette lingue
e a 390 px: selezione multipla, aggiunta/rimozione, città fuori catalogo, cambio
paese, ritorno al territorio ereditato/tutto il paese ed errori conservativi;
nessun errore browser o overflow. Anteprima locale aggiornata al form semplificato.
