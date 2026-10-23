# Forum: consultazione Manager Viewer — 23 ottobre 2026

Abilitata la voce Forum e il report delle statistiche al Manager Viewer dell’evento corrente. Disponibili programma, location, scuole, dettagli, iscritti, lista d’attesa ed esportazione Excel degli elenchi.

Il nuovo controllo `canViewPanelData` autorizza soltanto le letture e verifica l’evento corrente nel loader degli elenchi. Il controllo di gestione rimane distinto: nessuna facoltà aggiuntiva di modifica, pubblicazione, prenotazione o invio campagne. Un Manager di un altro evento con ruolo Viewer corrente conserva la sola lettura. Nessuna migration.

Verifiche: suite completa 1.075 test superati, poi 38 test mirati superati comprendenti una nuova regressione sui ruoli cumulati; TypeScript e build production superati. Lint dei file modificati superato. Il lint generale resta bloccato da tre errori `no-explicit-any` preesistenti in `tests/ceremony-navigation.test.mts` (righe 11, 12, 56). Nessuna prova su dati operativi reali né verifica browser autenticata.

Commit e push richiesti dall’utente. Le altre modifiche in corso nel checkout non appartengono a questo intervento.
