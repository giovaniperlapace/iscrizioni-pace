# Questionario iscrizione

Versione applicativa corrente: `2026-09-05-operative-groups`.

Questa versione copre l'evento Assisi 2026 e mantiene la prima iscrizione
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
| Paese europeo geografico e città | Sì | personale | `participants.country_id`, `city_id`, `country_other`, `city_other` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Disabilità o bisogni di accessibilità | Sì | sensibile | `accessibility_needs.washington_group_answers` | partecipante, manager, admin | Sì |
| Opzioni strutturate accessibilità | Solo se accessibilità = Sì | sensibile | `accessibility_needs` | partecipante, manager, admin | Sì |
| Hai partecipato ad altri eventi con la Comunità di Sant’Egidio? | Sì | operativo | `participants.has_previous_santegidio_participation` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Fai parte di qualche associazione? | No, solo se partecipazione con gruppo = No | operativo | snapshot `registration_questionnaire_answers.answers.externalGroupAssociation` | partecipante, manager, manager_viewer, admin | Sì |
| Parteciperai con un gruppo alla preghiera? | Sì | operativo | `participants.participates_with_group`, `participant_group_assignments`, snapshot `groupParticipation` | partecipante, capogruppo, manager, manager_viewer, admin | Sì |
| Fasce di presenza previste | Sì | operativo | `event_attendance_choices.day` + `day_part` e snapshot questionario | partecipante, capogruppo, manager, manager_viewer, admin, accoglienza | Sì |
| Privacy e consenso trattamento dati | Sì | legale | `participant_consents` | partecipante, manager, admin | No |
| Comunicazioni su eventi e iniziative future | No | legale | `participant_consents.future_events_communications_*` | partecipante, manager, admin | No |

La lingua preferita non viene più raccolta nei flussi di iscrizione o modifica
partecipante. Il modello dati conserva un valore tecnico di default per
compatibilità con lo schema esistente. Programma e momenti evento non sono
richiesti in questa prima iscrizione e restano supportati per dashboard o
passaggi successivi.

Tutti i campi visibili della prima iscrizione sono obbligatori, tranne il
telefono, l’associazione e il consenso separato per ricevere comunicazioni su eventi e
iniziative future. Quest'ultimo non e' preselezionato e non blocca
l'iscrizione. Se viene espresso, l'app registra esito positivo, data e versione
del testo; in caso contrario salva l'esito negativo senza data o versione di
accettazione. Il telefono può restare vuoto; se compilato, il form richiede un
prefisso internazionale e salva un numero normalizzato in formato `+...`.

## Logica condizionale

- Se accessibilità = No, non vengono mostrate domande ulteriori.
- Se accessibilità = Sì, viene mostrata una lista multi-selezione ispirata
  alle aree funzionali del Washington Group: udito, cammino/gradini,
  sedia a rotelle o ausilio per la mobilità.
- Le due domande sugli eventi precedenti e sulla partecipazione con un gruppo
  sono indipendenti, sempre visibili e obbligatorie in tutte le lingue.
- Se partecipazione con gruppo = No, compare l'associazione facoltativa,
  salvata nello snapshot; la persona resta realmente Senza gruppo.
- Se partecipazione con gruppo = Sì, compare la selezione cercabile per
  territorio/età. La selezione esplicita è subito operativa.
- `Non trovo il mio referente` consente l'iscrizione senza assegnazione.
- I link riservati preselezionano il gruppo e la seconda risposta Sì, ma
  consentono di cambiarla e non assumono partecipazioni precedenti.
- Prima della privacy viene chiesto in quali fasce la persona sarà presente:
  pomeriggio del giorno precedente l'inizio evento, poi mattina e pomeriggio
  per ogni giorno compreso tra `events.starts_on` e `events.ends_on`. In
  alternativa può scegliere `Non lo so ancora, lo comunicherò in seguito`; in
  quel caso le singole fasce non sono selezionabili.

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
- Quando il paese o la città inseriti corrispondono ai cataloghi `countries` e
  `cities`, l'app salva anche gli ID strutturati in `participants.country_id` e
  `participants.city_id`. I campi testuali restano nello snapshot e come
  fallback per valori non ancora presenti a catalogo.

## Matching gruppi

Il catalogo continua a usare territorio ed età per proporre gruppi pertinenti.
Solo la selezione esplicita con risposta Sì crea un'assegnazione; nessun nodo
territoriale o nuovi partecipanti viene assegnato automaticamente. Le versioni
storiche restano immutate. Migrazione e backfill degli stati:
`docs/operative-group-assignments.md`.
