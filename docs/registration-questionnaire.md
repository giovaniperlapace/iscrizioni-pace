# Questionario iscrizione

Versione applicativa corrente: `2026-06-14-first-event`.

Questa versione copre il primo evento di test e mantiene la prima iscrizione
essenziale e condizionale: i dati stabili restano in colonne o tabelle strutturate, mentre
`registration_questionnaire_answers` conserva uno snapshot versionato delle
risposte e della classificazione di visibilità. Lo snapshot serve per audit e
manutenzione futura, non per sostituire lo schema relazionale principale.

## Domande

| Domanda | Obbligatoria | Classe dato | Storage principale | Visibilità | Modificabile |
| --- | --- | --- | --- | --- | --- |
| Email | Sì | personale | `participant_contacts.email` | partecipante, manager, manager_viewer, admin | No |
| Telefono | No | personale | `participant_contacts.phone` | partecipante, manager, manager_viewer, admin | Sì |
| Nome, cognome, data di nascita | Sì | personale | `participants` | partecipante, capogruppo, manager, manager_viewer, admin, accoglienza | Sì |
| Luogo di nascita, paese e città | Sì | personale | snapshot `registration_questionnaire_answers.answers.birthPlace` | partecipante, manager, manager_viewer, admin | Sì |
| Nazionalità | Sì | personale | snapshot `registration_questionnaire_answers.answers.nationality` | partecipante, manager, manager_viewer, admin | Sì |
| Paese europeo geografico e città | Sì | personale | `participants.country_other`, `city_other` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Disabilità o bisogni di accessibilità | Sì | sensibile | `accessibility_needs.washington_group_answers` | partecipante, manager, admin | Sì |
| Dettagli accessibilità | Solo se accessibilità = Sì | sensibile | `accessibility_needs` | partecipante, manager, admin | Sì |
| Partecipazione precedente Sant'Egidio nella propria città | Sì | operativo | `participants.has_previous_santegidio_participation` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Partecipazione con gruppo | Solo se partecipazione precedente = Sì | operativo | `participants.participates_with_group`, `participant_group_assignments` o snapshot `groupName` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Giorni di presenza previsti | Sì | operativo | `event_attendance_choices` e snapshot questionario | partecipante, capogruppo, manager, manager_viewer, admin, accoglienza | Sì |
| Privacy e consenso trattamento dati | Sì | legale | `participant_consents` | partecipante, manager, admin | No |

Lingua preferita, programma e momenti evento non sono più richiesti in questa
prima iscrizione. Restano supportati dal modello dati per dashboard o passaggi
successivi.

Tutti i campi visibili della prima iscrizione sono obbligatori, tranne il
telefono. Il telefono può restare vuoto; se compilato, il form richiede un
prefisso internazionale e salva un numero normalizzato in formato `+...`.

## Logica condizionale

- Se accessibilità = No, non vengono mostrate domande ulteriori.
- Se accessibilità = Sì, viene mostrata una lista multi-selezione ispirata
  alle aree funzionali del Washington Group: vista, udito, cammino/gradini,
  cura di sé, memoria/concentrazione, comunicazione, sedia a rotelle o ausilio
  mobilità, assistenza durante l'evento.
- Se partecipazione precedente Sant'Egidio = No, il form passa alla privacy.
- Se partecipazione precedente Sant'Egidio = Sì, viene chiesto se la persona
  parteciperà con un gruppo.
- Se parteciperà con un gruppo = Sì, viene mostrata una lista di gruppi reali
  dell'evento o, in assenza di dati, una lista segnaposto.
- Prima della privacy viene chiesto in quali giorni dell'evento la persona sarà
  presente. I giorni sono generati da `events.starts_on` e `events.ends_on`, così
  cambiano automaticamente per eventi futuri di 2, 3, 4 o più giorni. In
  alternativa può scegliere `Non lo so ancora, lo comunicherò in seguito`; in
  quel caso i singoli giorni non sono selezionabili.

## Paesi e città

- Il paese e' cercabile su una lista di paesi dell'Europa geografica.
- L'opzione `Altro / non in lista` apre un campo libero per persone provenienti
  da paesi non europei.
- La città dipende dal paese scelto, e' cercabile e mostra una lista locale di
  città principali. Per l'Italia la lista include i principali capoluoghi di
  provincia; per gli altri paesi europei usa capitali e città di rilievo.
- Anche la città ha `Altro / non in lista`, con campo libero.
- La scelta e' ispirata a dataset come GeoNames e Natural Earth Populated
  Places, senza importare dataset completi nella prima versione del form.

## Nazionalità

- La nazionalità e' un campo cercabile basato su un elenco mondiale di 249
  voci.
- La lista locale deriva dal dataset pubblico `country-nationality-list`, basato
  su codici ISO 3166-1 e demonym/nationality list.
- Il valore e' salvato nello snapshot questionario, non normalizzato in una
  tabella dedicata.

## Test data

La migration `20260614100000_registration_questionnaire_and_test_seed.sql`
crea dati distinguibili dai reali:

- evento pubblicato `assisi-2026-test`;
- paesi `IT`, `GB`, `US`;
- città `Roma`, `Assisi`, `London`, `New York`;
- gruppo `Roma - Giovani per la Pace`;
- tre momenti pubblici di programma.

Per creare utenti test dopo aver applicato la migration:

```bash
TEST_ADMIN_EMAIL=admin-test@example.org \
TEST_MANAGER_EMAIL=manager-test@example.org \
TEST_PARTICIPANT_EMAIL=partecipante-test@example.org \
npm run bootstrap:test-users
```

Lo script richiede `SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` nell'ambiente locale. Non stampa la service role e
non crea dati personali reali.
