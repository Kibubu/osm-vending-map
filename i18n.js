/* Tiny i18n layer: picks the browser language (or the one the visitor chose), falls back to English.
 * Add a language: copy the `en` block, translate the values, add it to LANGS with a flag.
 * OSM tags, changeset comments and note texts stay English on purpose (shared with mappers worldwide).
 */
(function () {
  'use strict';

  const LANGS = {
    en: { flag: '🇬🇧', name: 'English' },
    de: { flag: '🇩🇪', name: 'Deutsch' },
    fr: { flag: '🇫🇷', name: 'Français' },
    es: { flag: '🇪🇸', name: 'Español' },
    it: { flag: '🇮🇹', name: 'Italiano' },
    nl: { flag: '🇳🇱', name: 'Nederlands' },
  };

  const STRINGS = {
    en: {
      'popup.where': "Where", 'popup.near': "Next to",
      'search.placeholder': "Search machines or places", 'search.clear': "Clear search", 'search.machines': "Vending machines ({n})", 'search.machinesNone': "No vending machines match", 'search.more': "{n} more — refine your search", 'search.places': "Places", 'search.findPlace': "Search for places named “{q}”", 'search.searching': "Searching…", 'search.placesNone': "No places found", 'search.failed': "Place search failed. Try again later.", 'search.offline': "Place search needs an internet connection.", 'search.retry': "Try again", 'search.coords': "Coordinates",
      "outbox.btn": "Not uploaded yet: {n}", "outbox.title": "Not uploaded yet", "outbox.intro": "These machines are saved on this device only. They stay here until they are on OpenStreetMap or you discard them.", "outbox.empty": "Nothing waiting: everything you entered is on OpenStreetMap.", "outbox.saved": "Your entry is saved on this device. You can retry any time from the 📤 button.", "outbox.status.pending": "waiting for login", "outbox.status.uploading": "uploading", "outbox.status.failed": "failed", "outbox.status.interrupted": "interrupted", "outbox.savedAt": "saved {date}", "outbox.attempts": "attempts: {n}", "outbox.lastError": "Last error", "outbox.log": "Log", "outbox.maybe": "This upload may already have reached OpenStreetMap. Retry checks for that first and will not create a duplicate.", "outbox.retry": "Retry upload", "outbox.retryAll": "Retry all", "outbox.edit": "Edit", "outbox.show": "Show on map", "outbox.note": "Send as note", "outbox.copy": "Copy", "outbox.copied": "Copied", "outbox.discard": "Discard", "outbox.confirm": "Really discard?", "outbox.download": "Download log (JSON)", "outbox.close": "Close", "outbox.already": "Already on OpenStreetMap: {link}. Removed from the list.", "outbox.done": "Uploaded: {link}", "outbox.noteDone": "Sent as {link}. Removed from the list.", "outbox.offline": "You were offline.",
      'ctl.satellite': 'Satellite view', 'ctl.mapView': 'Map view',
      'ctl.fastZoomOn': 'Faster zooming: on (skips map tiles while zooming, saves data)', 'ctl.fastZoomOff': 'Faster zooming: off (loads map tiles while zooming)',
      'app.title': 'Vending machines', 'filter.all': 'All', 'filter.none': 'None', 'filter.aria': 'Filter by type',
      'loading': 'Loading vending machines…', 'add.hint': 'Tap the map where the vending machine is', 'cancel': 'Cancel',
      'count.all': '{n} machines', 'count.some': '{n} of {total} machines',
      'stamp.asOf': 'OSM data as of {date}', 'stamp.live': 'live outside', 'stamp.region': 'Region: {region}', 'stamp.unknown': 'unknown', 'stamp.offline': 'offline copy', 'loading.slow': 'Slow connection, still loading…',
      'ctl.locate': 'Locate me', 'ctl.add': 'Add a missing vending machine', 'ctl.lang': 'Language', 'ctl.zoomIn': 'Zoom in', 'ctl.zoomOut': 'Zoom out',
      'geo.here': 'You are here', 'geo.unsupported': 'Geolocation is not supported by this browser.', 'geo.failed': 'Could not get your location: {msg}.', 'geo.denied': 'permission denied',
      'type.drinks': 'Drinks', 'type.food': 'Food & snacks', 'type.tobacco': 'Tobacco', 'type.tickets': 'Tickets & payment', 'type.health': 'Health & hygiene',
      'type.pets': 'Pets & animals', 'type.vehicles': 'Fuel & bikes', 'type.services': 'Services & returns', 'type.goods': 'Goods & novelties', 'type.other': 'Other / unknown',
      'item.drinks': 'Drinks', 'item.coffee': 'Coffee', 'item.water': 'Water', 'item.milk': 'Milk', 'item.sweets': 'Sweets', 'item.snacks': 'Snacks', 'item.food': 'Food',
      'item.eggs': 'Eggs', 'item.bread': 'Bread', 'item.ice_cream': 'Ice cream', 'item.meat': 'Meat', 'item.honey': 'Honey', 'item.cigarettes': 'Cigarettes',
      'item.e-cigarettes': 'E-cigarettes', 'item.parking_tickets': 'Parking tickets', 'item.public_transport_tickets': 'Transport tickets', 'item.admission_tickets': 'Admission tickets',
      'item.condoms': 'Condoms', 'item.feminine_hygiene': 'Feminine hygiene', 'item.excrement_bags': 'Dog waste bags', 'item.animal_feed': 'Animal feed', 'item.fishing_bait': 'Fishing bait',
      'item.fuel': 'Fuel', 'item.bicycle_tube': 'Bicycle tubes', 'item.bottle_return': 'Bottle return', 'item.newspapers': 'Newspapers', 'item.stamps': 'Stamps',
      'item.parcel_pickup': 'Parcel pickup', 'item.toys': 'Toys', 'item.flowers': 'Flowers', 'item.potatoes': 'Potatoes', 'item.cheese': 'Cheese', 'item.sausages': 'Sausages',
      'item.chewing_gums': 'Chewing gum', 'item.pizza': 'Pizza', 'item.vegetables': 'Vegetables',
      'pay.coins': 'Coins', 'pay.notes': 'Banknotes', 'pay.cash': 'Cash', 'pay.debit_cards': 'Debit card', 'pay.credit_cards': 'Credit card', 'pay.contactless': 'Contactless', 'pay.app': 'App', 'pay.cards': 'Cards',
      'popup.title': 'Vending machine', 'popup.type': 'Type', 'popup.operator': 'Operator', 'popup.brand': 'Brand', 'popup.opening_hours': 'Opening hours', 'popup.level': 'Level',
      'popup.note': 'Note', 'popup.payment': 'Payment', 'popup.unknown': 'unknown', 'popup.view': 'View on OSM', 'popup.edit': 'Edit on OSM', 'popup.share': '🔗 Share',
      'popup.copied': '✓ Link copied', 'popup.copyPrompt': 'Copy this link:',
      'live.zoomIn': 'Zoom in to load vending machines in this area', 'live.loading': 'Loading vending machines in this area…', 'live.loaded1': '1 more machine loaded',
      'live.loadedN': '{n} more machines loaded', 'live.none': 'No vending machines found here yet', 'live.busy': 'Could not load this area (weak or no connection?). Move the map to try again.',
      'err.title': 'Something went wrong', 'err.retry': 'Retry', 'err.dismiss': 'Dismiss', 'err.load': 'Could not load the vending machine data. {msg}',
      'err.offline': 'No network. The map will load as soon as you are back online.', 'err.timeout': 'The server took too long to answer.',
      'err.notFound': 'This vending machine could not be found — it may have been removed from OpenStreetMap.',
      'form.title': 'Add a vending machine', 'form.drag': 'Drag the pin to the exact spot.', 'form.sells': 'What does it sell?', 'form.otherPh': 'Other OSM value (English, e.g. potatoes)',
      'form.operator': 'Operator', 'form.operatorPh': 'e.g. Tabakwaren Union', 'form.brand': 'Brand', 'form.brandPh': 'e.g. Selecta', 'form.name': 'Name', 'form.nameHint': '(only if signposted)',
      'form.payment': 'Payment', 'form.hours': 'Opening hours', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Level', 'form.levelHint': '(indoors)', 'form.levelPh': '0, -1, 1…',
      'form.note': 'Note for mappers', 'form.optional': '(optional)', 'form.notePh': 'e.g. inside the station hall, next to the ticket office',
      'form.review': 'Review & add to OSM', 'form.sendNote': 'No OSM account? Send as a note', 'form.orOpen': 'Or open it in', 'form.josm': 'JOSM (prefilled)',
      'form.josmTitle': 'Needs JOSM running with Remote Control enabled', 'form.pickOne': 'Please pick at least one thing it sells.', 'form.hoursLong': 'Opening hours are too long.',
      'form.sendingNote': 'Sending note…', 'form.noteSent': '✅ Thanks! {link} created. A mapper will add the machine.', 'form.noteLink': 'Note #{id}', 'form.noteLinkNoId': 'Note',
      'form.noteFailed': 'Could not send the note ({msg}).',
      'review.title': 'Check before upload', 'review.intro': 'A new node will be created at {coords} with these tags:', 'review.upload': 'Upload to OpenStreetMap',
      'review.loginUpload': 'Log in & upload to OpenStreetMap', 'review.edit': '✏️ Edit', 'review.cancel': '✕ Cancel',
      'review.disclaimer': 'Uploaded under your own OSM account with the changeset comment and hashtag {tag}. Only add machines you have seen yourself.',
      'review.notConfigured': "Direct upload isn't set up on this site yet. Use the note option or the iD/JOSM links instead.",
      'review.loginFirst': "You'll be asked to log in to OpenStreetMap first (free account).", 'review.checking': 'Checking login…', 'review.as': 'Uploading as {user}',
      'review.dev': 'on the dev server', 'review.logout': 'log out', 'review.toOsm': 'Taking you to OpenStreetMap to log in…', 'review.uploading': 'Uploading…',
      'review.dupe1': 'There is already a vending machine within 20 m:', 'review.dupeN': 'There are already {n} vending machines within 20 m:',
      'review.dupeHint': 'Only upload if this is a different machine.', 'review.dupeView': 'view', 'review.dupeDefault': 'vending machine', 'review.thanks': 'Thank you!',
      'review.added': '✅ Added! {node} in {changeset}. It shows here now and for everyone after the next nightly data update.', 'review.node': 'Node {id}', 'review.changeset': 'changeset {id}',
      'review.notUploaded': 'Not uploaded', 'review.nothingChanged': 'Nothing was changed on OpenStreetMap. Tap ＋ to try again.', 'review.failed': 'Upload failed',
      'review.retryLoggedIn': 'You are logged in now — tap ＋ and try again.',
      'osm.loginCancelled': 'Login was cancelled on OpenStreetMap.', 'osm.stateMismatch': 'Login failed: state mismatch — please try again.',
      'osm.tooLong': 'Login took too long — please try again.', 'osm.expired': 'Your OSM login expired — please log in again.',
      'osm.notConfigured': 'Direct upload is not configured (missing OAuth Client ID).',
    },

    de: {
      'popup.where': "Wo", 'popup.near': "Neben",
      'search.placeholder': "Automaten oder Orte suchen", 'search.clear': "Suche löschen", 'search.machines': "Automaten ({n})", 'search.machinesNone': "Keine passenden Automaten", 'search.more': "{n} weitere – Suche verfeinern", 'search.places': "Orte", 'search.findPlace': "Nach Orten „{q}“ suchen", 'search.searching': "Suche läuft…", 'search.placesNone': "Keine Orte gefunden", 'search.failed': "Ortssuche fehlgeschlagen. Später noch einmal versuchen.", 'search.offline': "Die Ortssuche braucht eine Internetverbindung.", 'search.retry': "Noch einmal versuchen", 'search.coords': "Koordinaten",
      "outbox.btn": "Noch nicht hochgeladen: {n}", "outbox.title": "Noch nicht hochgeladen", "outbox.intro": "Diese Automaten sind nur auf diesem Gerät gespeichert. Sie bleiben hier, bis sie auf OpenStreetMap sind oder du sie verwirfst.", "outbox.empty": "Nichts offen: Alles, was du eingetragen hast, ist auf OpenStreetMap.", "outbox.saved": "Deine Eingabe ist auf diesem Gerät gespeichert. Du kannst es jederzeit über den 📤-Knopf erneut versuchen.", "outbox.status.pending": "wartet auf Anmeldung", "outbox.status.uploading": "wird hochgeladen", "outbox.status.failed": "fehlgeschlagen", "outbox.status.interrupted": "unterbrochen", "outbox.savedAt": "gespeichert {date}", "outbox.attempts": "Versuche: {n}", "outbox.lastError": "Letzter Fehler", "outbox.log": "Protokoll", "outbox.maybe": "Dieser Upload ist eventuell schon bei OpenStreetMap angekommen. Ein erneuter Versuch prüft das zuerst und legt kein Duplikat an.", "outbox.retry": "Erneut hochladen", "outbox.retryAll": "Alle erneut versuchen", "outbox.edit": "Bearbeiten", "outbox.show": "Auf Karte zeigen", "outbox.note": "Als Hinweis senden", "outbox.copy": "Kopieren", "outbox.copied": "Kopiert", "outbox.discard": "Verwerfen", "outbox.confirm": "Wirklich verwerfen?", "outbox.download": "Protokoll herunterladen (JSON)", "outbox.close": "Schließen", "outbox.already": "Schon auf OpenStreetMap: {link}. Aus der Liste entfernt.", "outbox.done": "Hochgeladen: {link}", "outbox.noteDone": "Als {link} gesendet. Aus der Liste entfernt.", "outbox.offline": "Du warst offline.",
      'ctl.satellite': 'Satellitenansicht', 'ctl.mapView': 'Kartenansicht',
      'ctl.fastZoomOn': 'Schnelleres Zoomen: an (lädt beim Zoomen keine Zwischenkacheln, spart Daten)', 'ctl.fastZoomOff': 'Schnelleres Zoomen: aus (lädt Kartenkacheln auch während des Zoomens)',
      'app.title': 'Verkaufsautomaten', 'filter.all': 'Alle', 'filter.none': 'Keine', 'filter.aria': 'Nach Art filtern',
      'loading': 'Verkaufsautomaten werden geladen …', 'add.hint': 'Tippe auf die Karte, wo der Automat steht', 'cancel': 'Abbrechen',
      'count.all': '{n} Automaten', 'count.some': '{n} von {total} Automaten',
      'stamp.asOf': 'OSM-Daten vom {date}', 'stamp.live': 'außerhalb live', 'stamp.region': 'Region: {region}', 'stamp.unknown': 'unbekannt', 'stamp.offline': 'Offline-Kopie', 'loading.slow': 'Langsame Verbindung, lädt noch …',
      'ctl.locate': 'Mein Standort', 'ctl.add': 'Fehlenden Automaten hinzufügen', 'ctl.lang': 'Sprache', 'ctl.zoomIn': 'Hineinzoomen', 'ctl.zoomOut': 'Herauszoomen',
      'geo.here': 'Du bist hier', 'geo.unsupported': 'Dein Browser unterstützt keine Standortbestimmung.', 'geo.failed': 'Standort konnte nicht ermittelt werden: {msg}.', 'geo.denied': 'Zugriff verweigert',
      'type.drinks': 'Getränke', 'type.food': 'Essen & Snacks', 'type.tobacco': 'Tabak', 'type.tickets': 'Tickets & Bezahlen', 'type.health': 'Gesundheit & Hygiene',
      'type.pets': 'Haustiere & Tiere', 'type.vehicles': 'Kraftstoff & Fahrrad', 'type.services': 'Service & Rückgabe', 'type.goods': 'Waren & Kurioses', 'type.other': 'Sonstige / unbekannt',
      'item.drinks': 'Getränke', 'item.coffee': 'Kaffee', 'item.water': 'Wasser', 'item.milk': 'Milch', 'item.sweets': 'Süßigkeiten', 'item.snacks': 'Snacks', 'item.food': 'Essen',
      'item.eggs': 'Eier', 'item.bread': 'Brot', 'item.ice_cream': 'Eis', 'item.meat': 'Fleisch', 'item.honey': 'Honig', 'item.cigarettes': 'Zigaretten',
      'item.e-cigarettes': 'E-Zigaretten', 'item.parking_tickets': 'Parkscheine', 'item.public_transport_tickets': 'Fahrkarten', 'item.admission_tickets': 'Eintrittskarten',
      'item.condoms': 'Kondome', 'item.feminine_hygiene': 'Damenhygiene', 'item.excrement_bags': 'Hundekotbeutel', 'item.animal_feed': 'Tierfutter', 'item.fishing_bait': 'Angelköder',
      'item.fuel': 'Kraftstoff', 'item.bicycle_tube': 'Fahrradschläuche', 'item.bottle_return': 'Pfandrückgabe', 'item.newspapers': 'Zeitungen', 'item.stamps': 'Briefmarken',
      'item.parcel_pickup': 'Paketabholung', 'item.toys': 'Spielzeug', 'item.flowers': 'Blumen', 'item.potatoes': 'Kartoffeln', 'item.cheese': 'Käse', 'item.sausages': 'Wurst',
      'item.chewing_gums': 'Kaugummi', 'item.pizza': 'Pizza', 'item.vegetables': 'Gemüse',
      'pay.coins': 'Münzen', 'pay.notes': 'Scheine', 'pay.cash': 'Bargeld', 'pay.debit_cards': 'Debitkarte', 'pay.credit_cards': 'Kreditkarte', 'pay.contactless': 'Kontaktlos', 'pay.app': 'App', 'pay.cards': 'Karten',
      'popup.title': 'Verkaufsautomat', 'popup.type': 'Art', 'popup.operator': 'Betreiber', 'popup.brand': 'Marke', 'popup.opening_hours': 'Öffnungszeiten', 'popup.level': 'Etage',
      'popup.note': 'Hinweis', 'popup.payment': 'Bezahlung', 'popup.unknown': 'unbekannt', 'popup.view': 'Auf OSM ansehen', 'popup.edit': 'Auf OSM bearbeiten', 'popup.share': '🔗 Teilen',
      'popup.copied': '✓ Link kopiert', 'popup.copyPrompt': 'Diesen Link kopieren:',
      'live.zoomIn': 'Hineinzoomen, um Automaten in diesem Gebiet zu laden', 'live.loading': 'Automaten in diesem Gebiet werden geladen …', 'live.loaded1': '1 weiterer Automat geladen',
      'live.loadedN': '{n} weitere Automaten geladen', 'live.none': 'Hier wurden noch keine Automaten gefunden', 'live.busy': 'Gebiet konnte nicht geladen werden (schwache oder keine Verbindung?). Verschiebe die Karte, um es erneut zu versuchen.',
      'err.title': 'Etwas ist schiefgelaufen', 'err.retry': 'Erneut versuchen', 'err.dismiss': 'Schließen', 'err.load': 'Die Automatendaten konnten nicht geladen werden. {msg}',
      'err.offline': 'Kein Netz. Die Karte lädt, sobald du wieder online bist.', 'err.timeout': 'Der Server hat zu lange nicht geantwortet.',
      'err.notFound': 'Dieser Automat wurde nicht gefunden – vielleicht wurde er aus OpenStreetMap entfernt.',
      'form.title': 'Verkaufsautomat hinzufügen', 'form.drag': 'Ziehe die Markierung an die genaue Stelle.', 'form.sells': 'Was wird verkauft?', 'form.otherPh': 'Anderer OSM-Wert (englisch, z. B. potatoes)',
      'form.operator': 'Betreiber', 'form.operatorPh': 'z. B. Tabakwaren Union', 'form.brand': 'Marke', 'form.brandPh': 'z. B. Selecta', 'form.name': 'Name', 'form.nameHint': '(nur wenn angeschrieben)',
      'form.payment': 'Bezahlung', 'form.hours': 'Öffnungszeiten', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Etage', 'form.levelHint': '(in Gebäuden)', 'form.levelPh': '0, -1, 1 …',
      'form.note': 'Hinweis für Mapper', 'form.optional': '(optional)', 'form.notePh': 'z. B. in der Bahnhofshalle neben dem Fahrkartenschalter',
      'form.review': 'Prüfen & zu OSM hinzufügen', 'form.sendNote': 'Kein OSM-Konto? Als Hinweis senden', 'form.orOpen': 'Oder öffnen in', 'form.josm': 'JOSM (vorausgefüllt)',
      'form.josmTitle': 'Benötigt laufendes JOSM mit aktivierter Fernsteuerung', 'form.pickOne': 'Bitte wähle mindestens eine Warenart aus.', 'form.hoursLong': 'Die Öffnungszeiten sind zu lang.',
      'form.sendingNote': 'Hinweis wird gesendet …', 'form.noteSent': '✅ Danke! {link} erstellt. Ein Mapper wird den Automaten eintragen.', 'form.noteLink': 'Hinweis #{id}', 'form.noteLinkNoId': 'Hinweis',
      'form.noteFailed': 'Der Hinweis konnte nicht gesendet werden ({msg}).',
      'review.title': 'Vor dem Hochladen prüfen', 'review.intro': 'Ein neuer Knoten wird bei {coords} mit diesen Tags angelegt:', 'review.upload': 'Zu OpenStreetMap hochladen',
      'review.loginUpload': 'Anmelden & zu OpenStreetMap hochladen', 'review.edit': '✏️ Bearbeiten', 'review.cancel': '✕ Abbrechen',
      'review.disclaimer': 'Wird mit deinem eigenen OSM-Konto hochgeladen, mit Änderungssatz-Kommentar und Hashtag {tag}. Füge nur Automaten hinzu, die du selbst gesehen hast.',
      'review.notConfigured': 'Direktes Hochladen ist auf dieser Seite noch nicht eingerichtet. Nutze stattdessen den Hinweis oder die iD-/JOSM-Links.',
      'review.loginFirst': 'Du wirst zuerst gebeten, dich bei OpenStreetMap anzumelden (kostenloses Konto).', 'review.checking': 'Anmeldung wird geprüft …', 'review.as': 'Hochladen als {user}',
      'review.dev': 'auf dem Testserver', 'review.logout': 'abmelden', 'review.toOsm': 'Weiterleitung zur Anmeldung bei OpenStreetMap …', 'review.uploading': 'Wird hochgeladen …',
      'review.dupe1': 'Im Umkreis von 20 m gibt es bereits einen Automaten:', 'review.dupeN': 'Im Umkreis von 20 m gibt es bereits {n} Automaten:',
      'review.dupeHint': 'Lade nur hoch, wenn es ein anderer Automat ist.', 'review.dupeView': 'ansehen', 'review.dupeDefault': 'Verkaufsautomat', 'review.thanks': 'Danke!',
      'review.added': '✅ Hinzugefügt! {node} in {changeset}. Er ist jetzt hier sichtbar und für alle nach der nächsten nächtlichen Aktualisierung.', 'review.node': 'Knoten {id}', 'review.changeset': 'Änderungssatz {id}',
      'review.notUploaded': 'Nicht hochgeladen', 'review.nothingChanged': 'Auf OpenStreetMap wurde nichts geändert. Tippe auf ＋, um es erneut zu versuchen.', 'review.failed': 'Hochladen fehlgeschlagen',
      'review.retryLoggedIn': 'Du bist jetzt angemeldet – tippe auf ＋ und versuche es erneut.',
      'osm.loginCancelled': 'Die Anmeldung wurde auf OpenStreetMap abgebrochen.', 'osm.stateMismatch': 'Anmeldung fehlgeschlagen (Statusabweichung) – bitte erneut versuchen.',
      'osm.tooLong': 'Die Anmeldung hat zu lange gedauert – bitte erneut versuchen.', 'osm.expired': 'Deine OSM-Anmeldung ist abgelaufen – bitte melde dich erneut an.',
      'osm.notConfigured': 'Direktes Hochladen ist nicht eingerichtet (OAuth-Client-ID fehlt).',
    },

    fr: {
      'popup.where': "Où", 'popup.near': "À côté de",
      'search.placeholder': "Chercher distributeurs ou lieux", 'search.clear': "Effacer la recherche", 'search.machines': "Distributeurs ({n})", 'search.machinesNone': "Aucun distributeur ne correspond", 'search.more': "{n} de plus – précisez la recherche", 'search.places': "Lieux", 'search.findPlace': "Chercher les lieux « {q} »", 'search.searching': "Recherche…", 'search.placesNone': "Aucun lieu trouvé", 'search.failed': "La recherche de lieux a échoué. Réessayez plus tard.", 'search.offline': "La recherche de lieux nécessite une connexion Internet.", 'search.retry': "Réessayer", 'search.coords': "Coordonnées",
      "outbox.btn": "Pas encore envoyés : {n}", "outbox.title": "Pas encore envoyés", "outbox.intro": "Ces distributeurs sont enregistrés uniquement sur cet appareil. Ils restent ici jusqu’à ce qu’ils soient sur OpenStreetMap ou que vous les supprimiez.", "outbox.empty": "Rien en attente : tout ce que vous avez saisi est sur OpenStreetMap.", "outbox.saved": "Votre saisie est enregistrée sur cet appareil. Vous pouvez réessayer à tout moment avec le bouton 📤.", "outbox.status.pending": "en attente de connexion", "outbox.status.uploading": "envoi en cours", "outbox.status.failed": "échec", "outbox.status.interrupted": "interrompu", "outbox.savedAt": "enregistré le {date}", "outbox.attempts": "tentatives : {n}", "outbox.lastError": "Dernière erreur", "outbox.log": "Journal", "outbox.maybe": "Cet envoi est peut-être déjà arrivé sur OpenStreetMap. Réessayer vérifie d’abord et ne crée pas de doublon.", "outbox.retry": "Réessayer l’envoi", "outbox.retryAll": "Tout réessayer", "outbox.edit": "Modifier", "outbox.show": "Voir sur la carte", "outbox.note": "Envoyer une note", "outbox.copy": "Copier", "outbox.copied": "Copié", "outbox.discard": "Supprimer", "outbox.confirm": "Vraiment supprimer ?", "outbox.download": "Télécharger le journal (JSON)", "outbox.close": "Fermer", "outbox.already": "Déjà sur OpenStreetMap : {link}. Retiré de la liste.", "outbox.done": "Envoyé : {link}", "outbox.noteDone": "Envoyé comme {link}. Retiré de la liste.", "outbox.offline": "Vous étiez hors ligne.",
      'ctl.satellite': 'Vue satellite', 'ctl.mapView': 'Vue carte',
      'ctl.fastZoomOn': 'Zoom plus rapide : activé (ignore les tuiles pendant le zoom, économise des données)', 'ctl.fastZoomOff': 'Zoom plus rapide : désactivé (charge les tuiles pendant le zoom)',
      'app.title': 'Distributeurs automatiques', 'filter.all': 'Tous', 'filter.none': 'Aucun', 'filter.aria': 'Filtrer par type',
      'loading': 'Chargement des distributeurs…', 'add.hint': 'Touchez la carte à l’endroit du distributeur', 'cancel': 'Annuler',
      'count.all': '{n} distributeurs', 'count.some': '{n} sur {total} distributeurs',
      'stamp.asOf': 'Données OSM du {date}', 'stamp.live': 'en direct ailleurs', 'stamp.region': 'Région : {region}', 'stamp.unknown': 'inconnue', 'stamp.offline': 'copie hors ligne', 'loading.slow': 'Connexion lente, chargement en cours…',
      'ctl.locate': 'Me localiser', 'ctl.add': 'Ajouter un distributeur manquant', 'ctl.lang': 'Langue', 'ctl.zoomIn': 'Zoomer', 'ctl.zoomOut': 'Dézoomer',
      'geo.here': 'Vous êtes ici', 'geo.unsupported': 'La géolocalisation n’est pas prise en charge par ce navigateur.', 'geo.failed': 'Impossible d’obtenir votre position : {msg}.', 'geo.denied': 'autorisation refusée',
      'type.drinks': 'Boissons', 'type.food': 'Nourriture & snacks', 'type.tobacco': 'Tabac', 'type.tickets': 'Billets & paiement', 'type.health': 'Santé & hygiène',
      'type.pets': 'Animaux', 'type.vehicles': 'Carburant & vélo', 'type.services': 'Services & consignes', 'type.goods': 'Objets & curiosités', 'type.other': 'Autre / inconnu',
      'item.drinks': 'Boissons', 'item.coffee': 'Café', 'item.water': 'Eau', 'item.milk': 'Lait', 'item.sweets': 'Confiseries', 'item.snacks': 'Snacks', 'item.food': 'Nourriture',
      'item.eggs': 'Œufs', 'item.bread': 'Pain', 'item.ice_cream': 'Glaces', 'item.meat': 'Viande', 'item.honey': 'Miel', 'item.cigarettes': 'Cigarettes',
      'item.e-cigarettes': 'Cigarettes électroniques', 'item.parking_tickets': 'Tickets de stationnement', 'item.public_transport_tickets': 'Titres de transport', 'item.admission_tickets': 'Billets d’entrée',
      'item.condoms': 'Préservatifs', 'item.feminine_hygiene': 'Hygiène féminine', 'item.excrement_bags': 'Sacs à déjections', 'item.animal_feed': 'Nourriture pour animaux', 'item.fishing_bait': 'Appâts de pêche',
      'item.fuel': 'Carburant', 'item.bicycle_tube': 'Chambres à air', 'item.bottle_return': 'Consigne de bouteilles', 'item.newspapers': 'Journaux', 'item.stamps': 'Timbres',
      'item.parcel_pickup': 'Retrait de colis', 'item.toys': 'Jouets', 'item.flowers': 'Fleurs', 'item.potatoes': 'Pommes de terre', 'item.cheese': 'Fromage', 'item.sausages': 'Saucisses',
      'item.chewing_gums': 'Chewing-gum', 'item.pizza': 'Pizza', 'item.vegetables': 'Légumes',
      'pay.coins': 'Pièces', 'pay.notes': 'Billets', 'pay.cash': 'Espèces', 'pay.debit_cards': 'Carte de débit', 'pay.credit_cards': 'Carte de crédit', 'pay.contactless': 'Sans contact', 'pay.app': 'Appli', 'pay.cards': 'Cartes',
      'popup.title': 'Distributeur automatique', 'popup.type': 'Type', 'popup.operator': 'Exploitant', 'popup.brand': 'Marque', 'popup.opening_hours': 'Horaires', 'popup.level': 'Niveau',
      'popup.note': 'Remarque', 'popup.payment': 'Paiement', 'popup.unknown': 'inconnu', 'popup.view': 'Voir sur OSM', 'popup.edit': 'Modifier sur OSM', 'popup.share': '🔗 Partager',
      'popup.copied': '✓ Lien copié', 'popup.copyPrompt': 'Copiez ce lien :',
      'live.zoomIn': 'Zoomez pour charger les distributeurs de cette zone', 'live.loading': 'Chargement des distributeurs de cette zone…', 'live.loaded1': '1 distributeur de plus chargé',
      'live.loadedN': '{n} distributeurs de plus chargés', 'live.none': 'Aucun distributeur trouvé ici pour l’instant', 'live.busy': 'Impossible de charger cette zone (connexion faible ou absente ?). Déplacez la carte pour réessayer.',
      'err.title': 'Un problème est survenu', 'err.retry': 'Réessayer', 'err.dismiss': 'Fermer', 'err.load': 'Impossible de charger les données des distributeurs. {msg}',
      'err.offline': 'Pas de réseau. La carte se chargera dès que vous serez de nouveau en ligne.', 'err.timeout': 'Le serveur a mis trop de temps à répondre.',
      'err.notFound': 'Ce distributeur est introuvable — il a peut-être été supprimé d’OpenStreetMap.',
      'form.title': 'Ajouter un distributeur', 'form.drag': 'Faites glisser l’épingle à l’endroit exact.', 'form.sells': 'Que vend-il ?', 'form.otherPh': 'Autre valeur OSM (en anglais, ex. potatoes)',
      'form.operator': 'Exploitant', 'form.operatorPh': 'ex. Selecta', 'form.brand': 'Marque', 'form.brandPh': 'ex. Coca-Cola', 'form.name': 'Nom', 'form.nameHint': '(seulement s’il est affiché)',
      'form.payment': 'Paiement', 'form.hours': 'Horaires', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Niveau', 'form.levelHint': '(en intérieur)', 'form.levelPh': '0, -1, 1…',
      'form.note': 'Remarque pour les contributeurs', 'form.optional': '(facultatif)', 'form.notePh': 'ex. dans le hall de la gare, à côté du guichet',
      'form.review': 'Vérifier & ajouter à OSM', 'form.sendNote': 'Pas de compte OSM ? Envoyer une note', 'form.orOpen': 'Ou ouvrir dans', 'form.josm': 'JOSM (prérempli)',
      'form.josmTitle': 'Nécessite JOSM lancé avec le contrôle à distance activé', 'form.pickOne': 'Choisissez au moins un produit vendu.', 'form.hoursLong': 'Les horaires sont trop longs.',
      'form.sendingNote': 'Envoi de la note…', 'form.noteSent': '✅ Merci ! {link} créée. Un contributeur ajoutera le distributeur.', 'form.noteLink': 'Note n° {id}', 'form.noteLinkNoId': 'Note',
      'form.noteFailed': 'Impossible d’envoyer la note ({msg}).',
      'review.title': 'Vérifier avant l’envoi', 'review.intro': 'Un nouveau nœud sera créé à {coords} avec ces attributs :', 'review.upload': 'Envoyer vers OpenStreetMap',
      'review.loginUpload': 'Se connecter & envoyer vers OpenStreetMap', 'review.edit': '✏️ Modifier', 'review.cancel': '✕ Annuler',
      'review.disclaimer': 'Envoyé avec votre propre compte OSM, avec le commentaire de groupe de modifications et le hashtag {tag}. N’ajoutez que des distributeurs que vous avez vus vous-même.',
      'review.notConfigured': 'L’envoi direct n’est pas encore configuré sur ce site. Utilisez la note ou les liens iD/JOSM.',
      'review.loginFirst': 'Il vous sera d’abord demandé de vous connecter à OpenStreetMap (compte gratuit).', 'review.checking': 'Vérification de la connexion…', 'review.as': 'Envoi en tant que {user}',
      'review.dev': 'sur le serveur de test', 'review.logout': 'se déconnecter', 'review.toOsm': 'Redirection vers OpenStreetMap pour la connexion…', 'review.uploading': 'Envoi…',
      'review.dupe1': 'Il y a déjà un distributeur à moins de 20 m :', 'review.dupeN': 'Il y a déjà {n} distributeurs à moins de 20 m :',
      'review.dupeHint': 'N’envoyez que s’il s’agit d’un autre distributeur.', 'review.dupeView': 'voir', 'review.dupeDefault': 'distributeur', 'review.thanks': 'Merci !',
      'review.added': '✅ Ajouté ! {node} dans le {changeset}. Il apparaît ici dès maintenant, et pour tout le monde après la prochaine mise à jour nocturne.', 'review.node': 'Nœud {id}', 'review.changeset': 'groupe de modifications {id}',
      'review.notUploaded': 'Non envoyé', 'review.nothingChanged': 'Rien n’a été modifié sur OpenStreetMap. Touchez ＋ pour réessayer.', 'review.failed': 'Échec de l’envoi',
      'review.retryLoggedIn': 'Vous êtes maintenant connecté — touchez ＋ et réessayez.',
      'osm.loginCancelled': 'La connexion a été annulée sur OpenStreetMap.', 'osm.stateMismatch': 'Échec de la connexion (état incohérent) — veuillez réessayer.',
      'osm.tooLong': 'La connexion a pris trop de temps — veuillez réessayer.', 'osm.expired': 'Votre connexion OSM a expiré — veuillez vous reconnecter.',
      'osm.notConfigured': 'L’envoi direct n’est pas configuré (identifiant client OAuth manquant).',
    },

    es: {
      'popup.where': "Dónde", 'popup.near': "Junto a",
      'search.placeholder': "Buscar máquinas o lugares", 'search.clear': "Borrar búsqueda", 'search.machines': "Máquinas ({n})", 'search.machinesNone': "Ninguna máquina coincide", 'search.more': "{n} más: afina la búsqueda", 'search.places': "Lugares", 'search.findPlace': "Buscar lugares «{q}»", 'search.searching': "Buscando…", 'search.placesNone': "No se encontraron lugares", 'search.failed': "La búsqueda de lugares falló. Inténtalo más tarde.", 'search.offline': "La búsqueda de lugares necesita conexión a Internet.", 'search.retry': "Reintentar", 'search.coords': "Coordenadas",
      "outbox.btn": "Sin subir todavía: {n}", "outbox.title": "Sin subir todavía", "outbox.intro": "Estas máquinas solo están guardadas en este dispositivo. Se quedan aquí hasta que estén en OpenStreetMap o las descartes.", "outbox.empty": "Nada pendiente: todo lo que has introducido está en OpenStreetMap.", "outbox.saved": "Tus datos están guardados en este dispositivo. Puedes reintentarlo cuando quieras con el botón 📤.", "outbox.status.pending": "esperando inicio de sesión", "outbox.status.uploading": "subiendo", "outbox.status.failed": "fallido", "outbox.status.interrupted": "interrumpido", "outbox.savedAt": "guardado el {date}", "outbox.attempts": "intentos: {n}", "outbox.lastError": "Último error", "outbox.log": "Registro", "outbox.maybe": "Puede que esta subida ya haya llegado a OpenStreetMap. Al reintentar se comprueba primero y no se crea un duplicado.", "outbox.retry": "Reintentar subida", "outbox.retryAll": "Reintentar todo", "outbox.edit": "Editar", "outbox.show": "Ver en el mapa", "outbox.note": "Enviar como nota", "outbox.copy": "Copiar", "outbox.copied": "Copiado", "outbox.discard": "Descartar", "outbox.confirm": "¿Descartar de verdad?", "outbox.download": "Descargar registro (JSON)", "outbox.close": "Cerrar", "outbox.already": "Ya está en OpenStreetMap: {link}. Quitado de la lista.", "outbox.done": "Subido: {link}", "outbox.noteDone": "Enviado como {link}. Quitado de la lista.", "outbox.offline": "Estabas sin conexión.",
      'ctl.satellite': 'Vista de satélite', 'ctl.mapView': 'Vista de mapa',
      'ctl.fastZoomOn': 'Zoom más rápido: activado (omite teselas durante el zoom, ahorra datos)', 'ctl.fastZoomOff': 'Zoom más rápido: desactivado (carga teselas durante el zoom)',
      'app.title': 'Máquinas expendedoras', 'filter.all': 'Todas', 'filter.none': 'Ninguna', 'filter.aria': 'Filtrar por tipo',
      'loading': 'Cargando máquinas expendedoras…', 'add.hint': 'Toca el mapa donde está la máquina', 'cancel': 'Cancelar',
      'count.all': '{n} máquinas', 'count.some': '{n} de {total} máquinas',
      'stamp.asOf': 'Datos de OSM del {date}', 'stamp.live': 'en vivo fuera', 'stamp.region': 'Región: {region}', 'stamp.unknown': 'desconocida', 'stamp.offline': 'copia sin conexión', 'loading.slow': 'Conexión lenta, sigue cargando…',
      'ctl.locate': 'Mi ubicación', 'ctl.add': 'Añadir una máquina que falta', 'ctl.lang': 'Idioma', 'ctl.zoomIn': 'Acercar', 'ctl.zoomOut': 'Alejar',
      'geo.here': 'Estás aquí', 'geo.unsupported': 'Este navegador no admite la geolocalización.', 'geo.failed': 'No se pudo obtener tu ubicación: {msg}.', 'geo.denied': 'permiso denegado',
      'type.drinks': 'Bebidas', 'type.food': 'Comida y snacks', 'type.tobacco': 'Tabaco', 'type.tickets': 'Billetes y pagos', 'type.health': 'Salud e higiene',
      'type.pets': 'Mascotas y animales', 'type.vehicles': 'Combustible y bici', 'type.services': 'Servicios y devoluciones', 'type.goods': 'Artículos y curiosidades', 'type.other': 'Otros / desconocido',
      'item.drinks': 'Bebidas', 'item.coffee': 'Café', 'item.water': 'Agua', 'item.milk': 'Leche', 'item.sweets': 'Dulces', 'item.snacks': 'Snacks', 'item.food': 'Comida',
      'item.eggs': 'Huevos', 'item.bread': 'Pan', 'item.ice_cream': 'Helados', 'item.meat': 'Carne', 'item.honey': 'Miel', 'item.cigarettes': 'Cigarrillos',
      'item.e-cigarettes': 'Cigarrillos electrónicos', 'item.parking_tickets': 'Tiques de aparcamiento', 'item.public_transport_tickets': 'Billetes de transporte', 'item.admission_tickets': 'Entradas',
      'item.condoms': 'Preservativos', 'item.feminine_hygiene': 'Higiene femenina', 'item.excrement_bags': 'Bolsas para excrementos', 'item.animal_feed': 'Comida para animales', 'item.fishing_bait': 'Cebo de pesca',
      'item.fuel': 'Combustible', 'item.bicycle_tube': 'Cámaras de bici', 'item.bottle_return': 'Devolución de envases', 'item.newspapers': 'Periódicos', 'item.stamps': 'Sellos',
      'item.parcel_pickup': 'Recogida de paquetes', 'item.toys': 'Juguetes', 'item.flowers': 'Flores', 'item.potatoes': 'Patatas', 'item.cheese': 'Queso', 'item.sausages': 'Embutidos',
      'item.chewing_gums': 'Chicles', 'item.pizza': 'Pizza', 'item.vegetables': 'Verduras',
      'pay.coins': 'Monedas', 'pay.notes': 'Billetes', 'pay.cash': 'Efectivo', 'pay.debit_cards': 'Tarjeta de débito', 'pay.credit_cards': 'Tarjeta de crédito', 'pay.contactless': 'Sin contacto', 'pay.app': 'App', 'pay.cards': 'Tarjetas',
      'popup.title': 'Máquina expendedora', 'popup.type': 'Tipo', 'popup.operator': 'Operador', 'popup.brand': 'Marca', 'popup.opening_hours': 'Horario', 'popup.level': 'Planta',
      'popup.note': 'Nota', 'popup.payment': 'Pago', 'popup.unknown': 'desconocido', 'popup.view': 'Ver en OSM', 'popup.edit': 'Editar en OSM', 'popup.share': '🔗 Compartir',
      'popup.copied': '✓ Enlace copiado', 'popup.copyPrompt': 'Copia este enlace:',
      'live.zoomIn': 'Acerca el mapa para cargar las máquinas de esta zona', 'live.loading': 'Cargando máquinas de esta zona…', 'live.loaded1': '1 máquina más cargada',
      'live.loadedN': '{n} máquinas más cargadas', 'live.none': 'Aún no hay máquinas aquí', 'live.busy': 'No se pudo cargar esta zona (¿conexión débil o sin conexión?). Mueve el mapa para reintentar.',
      'err.title': 'Algo salió mal', 'err.retry': 'Reintentar', 'err.dismiss': 'Cerrar', 'err.load': 'No se pudieron cargar los datos de las máquinas. {msg}',
      'err.offline': 'Sin red. El mapa se cargará en cuanto vuelvas a tener conexión.', 'err.timeout': 'El servidor tardó demasiado en responder.',
      'err.notFound': 'No se encontró esta máquina; puede que se haya eliminado de OpenStreetMap.',
      'form.title': 'Añadir una máquina expendedora', 'form.drag': 'Arrastra el marcador al lugar exacto.', 'form.sells': '¿Qué vende?', 'form.otherPh': 'Otro valor OSM (en inglés, p. ej. potatoes)',
      'form.operator': 'Operador', 'form.operatorPh': 'p. ej. Selecta', 'form.brand': 'Marca', 'form.brandPh': 'p. ej. Coca-Cola', 'form.name': 'Nombre', 'form.nameHint': '(solo si está rotulado)',
      'form.payment': 'Pago', 'form.hours': 'Horario', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Planta', 'form.levelHint': '(en interiores)', 'form.levelPh': '0, -1, 1…',
      'form.note': 'Nota para mapeadores', 'form.optional': '(opcional)', 'form.notePh': 'p. ej. en el vestíbulo de la estación, junto a la taquilla',
      'form.review': 'Revisar y añadir a OSM', 'form.sendNote': '¿Sin cuenta de OSM? Enviar como nota', 'form.orOpen': 'O abrir en', 'form.josm': 'JOSM (rellenado)',
      'form.josmTitle': 'Requiere JOSM abierto con el control remoto activado', 'form.pickOne': 'Elige al menos un producto que venda.', 'form.hoursLong': 'El horario es demasiado largo.',
      'form.sendingNote': 'Enviando nota…', 'form.noteSent': '✅ ¡Gracias! {link} creada. Un mapeador añadirá la máquina.', 'form.noteLink': 'Nota n.º {id}', 'form.noteLinkNoId': 'Nota',
      'form.noteFailed': 'No se pudo enviar la nota ({msg}).',
      'review.title': 'Revisar antes de subir', 'review.intro': 'Se creará un nodo nuevo en {coords} con estas etiquetas:', 'review.upload': 'Subir a OpenStreetMap',
      'review.loginUpload': 'Iniciar sesión y subir a OpenStreetMap', 'review.edit': '✏️ Editar', 'review.cancel': '✕ Cancelar',
      'review.disclaimer': 'Se sube con tu propia cuenta de OSM, con el comentario del conjunto de cambios y el hashtag {tag}. Añade solo máquinas que hayas visto tú.',
      'review.notConfigured': 'La subida directa aún no está configurada en este sitio. Usa la nota o los enlaces de iD/JOSM.',
      'review.loginFirst': 'Primero se te pedirá iniciar sesión en OpenStreetMap (cuenta gratuita).', 'review.checking': 'Comprobando sesión…', 'review.as': 'Subiendo como {user}',
      'review.dev': 'en el servidor de pruebas', 'review.logout': 'cerrar sesión', 'review.toOsm': 'Llevándote a OpenStreetMap para iniciar sesión…', 'review.uploading': 'Subiendo…',
      'review.dupe1': 'Ya hay una máquina expendedora a menos de 20 m:', 'review.dupeN': 'Ya hay {n} máquinas expendedoras a menos de 20 m:',
      'review.dupeHint': 'Sube solo si es una máquina distinta.', 'review.dupeView': 'ver', 'review.dupeDefault': 'máquina expendedora', 'review.thanks': '¡Gracias!',
      'review.added': '✅ ¡Añadida! {node} en el {changeset}. Ya aparece aquí y para todos tras la próxima actualización nocturna.', 'review.node': 'Nodo {id}', 'review.changeset': 'conjunto de cambios {id}',
      'review.notUploaded': 'No se ha subido', 'review.nothingChanged': 'No se cambió nada en OpenStreetMap. Toca ＋ para intentarlo de nuevo.', 'review.failed': 'Error al subir',
      'review.retryLoggedIn': 'Ya has iniciado sesión: toca ＋ e inténtalo de nuevo.',
      'osm.loginCancelled': 'Se canceló el inicio de sesión en OpenStreetMap.', 'osm.stateMismatch': 'Error de inicio de sesión (estado no coincide); inténtalo de nuevo.',
      'osm.tooLong': 'El inicio de sesión tardó demasiado; inténtalo de nuevo.', 'osm.expired': 'Tu sesión de OSM ha caducado; vuelve a iniciar sesión.',
      'osm.notConfigured': 'La subida directa no está configurada (falta el ID de cliente OAuth).',
    },

    it: {
      'popup.where': "Dove", 'popup.near': "Accanto a",
      'search.placeholder': "Cerca distributori o luoghi", 'search.clear': "Cancella ricerca", 'search.machines': "Distributori ({n})", 'search.machinesNone': "Nessun distributore corrisponde", 'search.more': "Altri {n}: affina la ricerca", 'search.places': "Luoghi", 'search.findPlace': "Cerca luoghi «{q}»", 'search.searching': "Ricerca…", 'search.placesNone': "Nessun luogo trovato", 'search.failed': "Ricerca dei luoghi non riuscita. Riprova più tardi.", 'search.offline': "La ricerca dei luoghi richiede una connessione Internet.", 'search.retry': "Riprova", 'search.coords': "Coordinate",
      "outbox.btn": "Non ancora caricati: {n}", "outbox.title": "Non ancora caricati", "outbox.intro": "Questi distributori sono salvati solo su questo dispositivo. Restano qui finché non sono su OpenStreetMap o li scarti.", "outbox.empty": "Niente in sospeso: tutto ciò che hai inserito è su OpenStreetMap.", "outbox.saved": "I tuoi dati sono salvati su questo dispositivo. Puoi riprovare quando vuoi con il pulsante 📤.", "outbox.status.pending": "in attesa di accesso", "outbox.status.uploading": "caricamento", "outbox.status.failed": "non riuscito", "outbox.status.interrupted": "interrotto", "outbox.savedAt": "salvato il {date}", "outbox.attempts": "tentativi: {n}", "outbox.lastError": "Ultimo errore", "outbox.log": "Registro", "outbox.maybe": "Questo caricamento potrebbe essere già arrivato su OpenStreetMap. Riprovando si controlla prima e non si crea un duplicato.", "outbox.retry": "Riprova il caricamento", "outbox.retryAll": "Riprova tutti", "outbox.edit": "Modifica", "outbox.show": "Mostra sulla mappa", "outbox.note": "Invia come nota", "outbox.copy": "Copia", "outbox.copied": "Copiato", "outbox.discard": "Scarta", "outbox.confirm": "Scartare davvero?", "outbox.download": "Scarica il registro (JSON)", "outbox.close": "Chiudi", "outbox.already": "Già su OpenStreetMap: {link}. Rimosso dall’elenco.", "outbox.done": "Caricato: {link}", "outbox.noteDone": "Inviato come {link}. Rimosso dall’elenco.", "outbox.offline": "Eri offline.",
      'ctl.satellite': 'Vista satellite', 'ctl.mapView': 'Vista mappa',
      'ctl.fastZoomOn': 'Zoom più veloce: attivo (salta le tessere durante lo zoom, risparmia dati)', 'ctl.fastZoomOff': 'Zoom più veloce: disattivo (carica le tessere durante lo zoom)',
      'app.title': 'Distributori automatici', 'filter.all': 'Tutti', 'filter.none': 'Nessuno', 'filter.aria': 'Filtra per tipo',
      'loading': 'Caricamento dei distributori…', 'add.hint': 'Tocca la mappa dove si trova il distributore', 'cancel': 'Annulla',
      'count.all': '{n} distributori', 'count.some': '{n} di {total} distributori',
      'stamp.asOf': 'Dati OSM del {date}', 'stamp.live': 'in diretta altrove', 'stamp.region': 'Regione: {region}', 'stamp.unknown': 'sconosciuta', 'stamp.offline': 'copia offline', 'loading.slow': 'Connessione lenta, caricamento in corso…',
      'ctl.locate': 'La mia posizione', 'ctl.add': 'Aggiungi un distributore mancante', 'ctl.lang': 'Lingua', 'ctl.zoomIn': 'Ingrandisci', 'ctl.zoomOut': 'Riduci',
      'geo.here': 'Sei qui', 'geo.unsupported': 'Questo browser non supporta la geolocalizzazione.', 'geo.failed': 'Impossibile ottenere la posizione: {msg}.', 'geo.denied': 'permesso negato',
      'type.drinks': 'Bevande', 'type.food': 'Cibo e snack', 'type.tobacco': 'Tabacco', 'type.tickets': 'Biglietti e pagamenti', 'type.health': 'Salute e igiene',
      'type.pets': 'Animali', 'type.vehicles': 'Carburante e bici', 'type.services': 'Servizi e resi', 'type.goods': 'Oggetti e curiosità', 'type.other': 'Altro / sconosciuto',
      'item.drinks': 'Bevande', 'item.coffee': 'Caffè', 'item.water': 'Acqua', 'item.milk': 'Latte', 'item.sweets': 'Dolciumi', 'item.snacks': 'Snack', 'item.food': 'Cibo',
      'item.eggs': 'Uova', 'item.bread': 'Pane', 'item.ice_cream': 'Gelati', 'item.meat': 'Carne', 'item.honey': 'Miele', 'item.cigarettes': 'Sigarette',
      'item.e-cigarettes': 'Sigarette elettroniche', 'item.parking_tickets': 'Biglietti per il parcheggio', 'item.public_transport_tickets': 'Biglietti dei trasporti', 'item.admission_tickets': 'Biglietti d’ingresso',
      'item.condoms': 'Preservativi', 'item.feminine_hygiene': 'Igiene femminile', 'item.excrement_bags': 'Sacchetti per deiezioni', 'item.animal_feed': 'Mangime per animali', 'item.fishing_bait': 'Esche da pesca',
      'item.fuel': 'Carburante', 'item.bicycle_tube': 'Camere d’aria', 'item.bottle_return': 'Reso bottiglie', 'item.newspapers': 'Giornali', 'item.stamps': 'Francobolli',
      'item.parcel_pickup': 'Ritiro pacchi', 'item.toys': 'Giocattoli', 'item.flowers': 'Fiori', 'item.potatoes': 'Patate', 'item.cheese': 'Formaggio', 'item.sausages': 'Salumi',
      'item.chewing_gums': 'Gomme da masticare', 'item.pizza': 'Pizza', 'item.vegetables': 'Verdure',
      'pay.coins': 'Monete', 'pay.notes': 'Banconote', 'pay.cash': 'Contanti', 'pay.debit_cards': 'Carta di debito', 'pay.credit_cards': 'Carta di credito', 'pay.contactless': 'Contactless', 'pay.app': 'App', 'pay.cards': 'Carte',
      'popup.title': 'Distributore automatico', 'popup.type': 'Tipo', 'popup.operator': 'Gestore', 'popup.brand': 'Marchio', 'popup.opening_hours': 'Orari', 'popup.level': 'Piano',
      'popup.note': 'Nota', 'popup.payment': 'Pagamento', 'popup.unknown': 'sconosciuto', 'popup.view': 'Vedi su OSM', 'popup.edit': 'Modifica su OSM', 'popup.share': '🔗 Condividi',
      'popup.copied': '✓ Link copiato', 'popup.copyPrompt': 'Copia questo link:',
      'live.zoomIn': 'Ingrandisci per caricare i distributori di questa zona', 'live.loading': 'Caricamento dei distributori di questa zona…', 'live.loaded1': '1 distributore in più caricato',
      'live.loadedN': '{n} distributori in più caricati', 'live.none': 'Ancora nessun distributore qui', 'live.busy': 'Impossibile caricare questa zona (connessione debole o assente?). Sposta la mappa per riprovare.',
      'err.title': 'Qualcosa è andato storto', 'err.retry': 'Riprova', 'err.dismiss': 'Chiudi', 'err.load': 'Impossibile caricare i dati dei distributori. {msg}',
      'err.offline': 'Nessuna rete. La mappa si caricherà appena torni online.', 'err.timeout': 'Il server ha impiegato troppo a rispondere.',
      'err.notFound': 'Distributore non trovato: potrebbe essere stato rimosso da OpenStreetMap.',
      'form.title': 'Aggiungi un distributore', 'form.drag': 'Trascina il segnaposto nel punto esatto.', 'form.sells': 'Cosa vende?', 'form.otherPh': 'Altro valore OSM (in inglese, es. potatoes)',
      'form.operator': 'Gestore', 'form.operatorPh': 'es. Selecta', 'form.brand': 'Marchio', 'form.brandPh': 'es. Coca-Cola', 'form.name': 'Nome', 'form.nameHint': '(solo se indicato)',
      'form.payment': 'Pagamento', 'form.hours': 'Orari', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Piano', 'form.levelHint': '(al chiuso)', 'form.levelPh': '0, -1, 1…',
      'form.note': 'Nota per i mappatori', 'form.optional': '(facoltativo)', 'form.notePh': 'es. nell’atrio della stazione, accanto alla biglietteria',
      'form.review': 'Controlla e aggiungi a OSM', 'form.sendNote': 'Nessun account OSM? Invia come nota', 'form.orOpen': 'Oppure apri in', 'form.josm': 'JOSM (precompilato)',
      'form.josmTitle': 'Richiede JOSM aperto con il controllo remoto attivo', 'form.pickOne': 'Scegli almeno un prodotto venduto.', 'form.hoursLong': 'Gli orari sono troppo lunghi.',
      'form.sendingNote': 'Invio della nota…', 'form.noteSent': '✅ Grazie! {link} creata. Un mappatore aggiungerà il distributore.', 'form.noteLink': 'Nota n. {id}', 'form.noteLinkNoId': 'Nota',
      'form.noteFailed': 'Impossibile inviare la nota ({msg}).',
      'review.title': 'Controlla prima di caricare', 'review.intro': 'Verrà creato un nuovo nodo in {coords} con questi tag:', 'review.upload': 'Carica su OpenStreetMap',
      'review.loginUpload': 'Accedi e carica su OpenStreetMap', 'review.edit': '✏️ Modifica', 'review.cancel': '✕ Annulla',
      'review.disclaimer': 'Caricato con il tuo account OSM, con il commento del changeset e l’hashtag {tag}. Aggiungi solo distributori che hai visto di persona.',
      'review.notConfigured': 'Il caricamento diretto non è ancora configurato su questo sito. Usa la nota o i link iD/JOSM.',
      'review.loginFirst': 'Ti verrà prima chiesto di accedere a OpenStreetMap (account gratuito).', 'review.checking': 'Verifica dell’accesso…', 'review.as': 'Caricamento come {user}',
      'review.dev': 'sul server di prova', 'review.logout': 'esci', 'review.toOsm': 'Ti portiamo su OpenStreetMap per l’accesso…', 'review.uploading': 'Caricamento…',
      'review.dupe1': 'C’è già un distributore entro 20 m:', 'review.dupeN': 'Ci sono già {n} distributori entro 20 m:',
      'review.dupeHint': 'Carica solo se è un distributore diverso.', 'review.dupeView': 'vedi', 'review.dupeDefault': 'distributore', 'review.thanks': 'Grazie!',
      'review.added': '✅ Aggiunto! {node} nel {changeset}. È visibile qui da subito e per tutti dopo il prossimo aggiornamento notturno.', 'review.node': 'Nodo {id}', 'review.changeset': 'changeset {id}',
      'review.notUploaded': 'Non caricato', 'review.nothingChanged': 'Nulla è stato modificato su OpenStreetMap. Tocca ＋ per riprovare.', 'review.failed': 'Caricamento non riuscito',
      'review.retryLoggedIn': 'Ora hai effettuato l’accesso: tocca ＋ e riprova.',
      'osm.loginCancelled': 'L’accesso è stato annullato su OpenStreetMap.', 'osm.stateMismatch': 'Accesso non riuscito (stato non corrispondente): riprova.',
      'osm.tooLong': 'L’accesso ha richiesto troppo tempo: riprova.', 'osm.expired': 'L’accesso a OSM è scaduto: accedi di nuovo.',
      'osm.notConfigured': 'Il caricamento diretto non è configurato (manca il Client ID OAuth).',
    },

    nl: {
      'popup.where': "Waar", 'popup.near': "Naast",
      'search.placeholder': "Zoek automaten of plaatsen", 'search.clear': "Zoekopdracht wissen", 'search.machines': "Automaten ({n})", 'search.machinesNone': "Geen automaten gevonden", 'search.more': "Nog {n} – verfijn je zoekopdracht", 'search.places': "Plaatsen", 'search.findPlace': "Zoek plaatsen „{q}”", 'search.searching': "Zoeken…", 'search.placesNone': "Geen plaatsen gevonden", 'search.failed': "Plaatsen zoeken mislukt. Probeer het later opnieuw.", 'search.offline': "Plaatsen zoeken heeft een internetverbinding nodig.", 'search.retry': "Opnieuw proberen", 'search.coords': "Coördinaten",
      "outbox.btn": "Nog niet geüpload: {n}", "outbox.title": "Nog niet geüpload", "outbox.intro": "Deze automaten zijn alleen op dit apparaat opgeslagen. Ze blijven hier tot ze op OpenStreetMap staan of je ze weggooit.", "outbox.empty": "Niets in de wachtrij: alles wat je hebt ingevoerd staat op OpenStreetMap.", "outbox.saved": "Je invoer is op dit apparaat opgeslagen. Je kunt het altijd opnieuw proberen via de 📤-knop.", "outbox.status.pending": "wacht op inloggen", "outbox.status.uploading": "bezig met uploaden", "outbox.status.failed": "mislukt", "outbox.status.interrupted": "onderbroken", "outbox.savedAt": "opgeslagen {date}", "outbox.attempts": "pogingen: {n}", "outbox.lastError": "Laatste fout", "outbox.log": "Logboek", "outbox.maybe": "Deze upload is misschien al bij OpenStreetMap aangekomen. Opnieuw proberen controleert dat eerst en maakt geen dubbele.", "outbox.retry": "Opnieuw uploaden", "outbox.retryAll": "Alles opnieuw", "outbox.edit": "Bewerken", "outbox.show": "Op kaart tonen", "outbox.note": "Als opmerking sturen", "outbox.copy": "Kopiëren", "outbox.copied": "Gekopieerd", "outbox.discard": "Weggooien", "outbox.confirm": "Echt weggooien?", "outbox.download": "Logboek downloaden (JSON)", "outbox.close": "Sluiten", "outbox.already": "Staat al op OpenStreetMap: {link}. Uit de lijst gehaald.", "outbox.done": "Geüpload: {link}", "outbox.noteDone": "Verstuurd als {link}. Uit de lijst gehaald.", "outbox.offline": "Je was offline.",
      'ctl.satellite': 'Satellietweergave', 'ctl.mapView': 'Kaartweergave',
      'ctl.fastZoomOn': 'Sneller zoomen: aan (slaat kaarttegels over tijdens het zoomen, bespaart data)', 'ctl.fastZoomOff': 'Sneller zoomen: uit (laadt kaarttegels tijdens het zoomen)',
      'app.title': 'Automaten', 'filter.all': 'Alle', 'filter.none': 'Geen', 'filter.aria': 'Filteren op soort',
      'loading': 'Automaten laden…', 'add.hint': 'Tik op de kaart waar de automaat staat', 'cancel': 'Annuleren',
      'count.all': '{n} automaten', 'count.some': '{n} van {total} automaten',
      'stamp.asOf': 'OSM-gegevens van {date}', 'stamp.live': 'live daarbuiten', 'stamp.region': 'Regio: {region}', 'stamp.unknown': 'onbekend', 'stamp.offline': 'offline kopie', 'loading.slow': 'Trage verbinding, nog aan het laden…',
      'ctl.locate': 'Mijn locatie', 'ctl.add': 'Ontbrekende automaat toevoegen', 'ctl.lang': 'Taal', 'ctl.zoomIn': 'Inzoomen', 'ctl.zoomOut': 'Uitzoomen',
      'geo.here': 'Je bent hier', 'geo.unsupported': 'Deze browser ondersteunt geen locatiebepaling.', 'geo.failed': 'Kan je locatie niet bepalen: {msg}.', 'geo.denied': 'toestemming geweigerd',
      'type.drinks': 'Dranken', 'type.food': 'Eten & snacks', 'type.tobacco': 'Tabak', 'type.tickets': 'Kaartjes & betalen', 'type.health': 'Gezondheid & hygiëne',
      'type.pets': 'Huisdieren & dieren', 'type.vehicles': 'Brandstof & fiets', 'type.services': 'Diensten & retour', 'type.goods': 'Spullen & curiosa', 'type.other': 'Overig / onbekend',
      'item.drinks': 'Dranken', 'item.coffee': 'Koffie', 'item.water': 'Water', 'item.milk': 'Melk', 'item.sweets': 'Snoep', 'item.snacks': 'Snacks', 'item.food': 'Eten',
      'item.eggs': 'Eieren', 'item.bread': 'Brood', 'item.ice_cream': 'IJs', 'item.meat': 'Vlees', 'item.honey': 'Honing', 'item.cigarettes': 'Sigaretten',
      'item.e-cigarettes': 'E-sigaretten', 'item.parking_tickets': 'Parkeerkaartjes', 'item.public_transport_tickets': 'Vervoersbewijzen', 'item.admission_tickets': 'Toegangskaartjes',
      'item.condoms': 'Condooms', 'item.feminine_hygiene': 'Damesverband', 'item.excrement_bags': 'Hondenpoepzakjes', 'item.animal_feed': 'Diervoer', 'item.fishing_bait': 'Visaas',
      'item.fuel': 'Brandstof', 'item.bicycle_tube': 'Fietsbinnenbanden', 'item.bottle_return': 'Statiegeld', 'item.newspapers': 'Kranten', 'item.stamps': 'Postzegels',
      'item.parcel_pickup': 'Pakketafhaling', 'item.toys': 'Speelgoed', 'item.flowers': 'Bloemen', 'item.potatoes': 'Aardappelen', 'item.cheese': 'Kaas', 'item.sausages': 'Worst',
      'item.chewing_gums': 'Kauwgom', 'item.pizza': 'Pizza', 'item.vegetables': 'Groente',
      'pay.coins': 'Munten', 'pay.notes': 'Bankbiljetten', 'pay.cash': 'Contant', 'pay.debit_cards': 'Pinpas', 'pay.credit_cards': 'Creditcard', 'pay.contactless': 'Contactloos', 'pay.app': 'App', 'pay.cards': 'Kaarten',
      'popup.title': 'Automaat', 'popup.type': 'Soort', 'popup.operator': 'Exploitant', 'popup.brand': 'Merk', 'popup.opening_hours': 'Openingstijden', 'popup.level': 'Verdieping',
      'popup.note': 'Opmerking', 'popup.payment': 'Betalen', 'popup.unknown': 'onbekend', 'popup.view': 'Bekijk op OSM', 'popup.edit': 'Bewerk op OSM', 'popup.share': '🔗 Delen',
      'popup.copied': '✓ Link gekopieerd', 'popup.copyPrompt': 'Kopieer deze link:',
      'live.zoomIn': 'Zoom in om automaten in dit gebied te laden', 'live.loading': 'Automaten in dit gebied laden…', 'live.loaded1': '1 extra automaat geladen',
      'live.loadedN': '{n} extra automaten geladen', 'live.none': 'Hier nog geen automaten gevonden', 'live.busy': 'Dit gebied kon niet worden geladen (zwakke of geen verbinding?). Verschuif de kaart om het opnieuw te proberen.',
      'err.title': 'Er ging iets mis', 'err.retry': 'Opnieuw', 'err.dismiss': 'Sluiten', 'err.load': 'De automaatgegevens konden niet worden geladen. {msg}',
      'err.offline': 'Geen netwerk. De kaart laadt zodra je weer online bent.', 'err.timeout': 'De server reageerde te traag.',
      'err.notFound': 'Deze automaat is niet gevonden — misschien is hij uit OpenStreetMap verwijderd.',
      'form.title': 'Automaat toevoegen', 'form.drag': 'Sleep de speld naar de juiste plek.', 'form.sells': 'Wat verkoopt hij?', 'form.otherPh': 'Andere OSM-waarde (Engels, bijv. potatoes)',
      'form.operator': 'Exploitant', 'form.operatorPh': 'bijv. Selecta', 'form.brand': 'Merk', 'form.brandPh': 'bijv. Coca-Cola', 'form.name': 'Naam', 'form.nameHint': '(alleen als het erop staat)',
      'form.payment': 'Betalen', 'form.hours': 'Openingstijden', 'form.hoursPh': 'Mo-Sa 06:00-22:00', 'form.level': 'Verdieping', 'form.levelHint': '(binnen)', 'form.levelPh': '0, -1, 1…',
      'form.note': 'Opmerking voor mappers', 'form.optional': '(optioneel)', 'form.notePh': 'bijv. in de stationshal, naast het loket',
      'form.review': 'Controleren & toevoegen aan OSM', 'form.sendNote': 'Geen OSM-account? Stuur als opmerking', 'form.orOpen': 'Of open in', 'form.josm': 'JOSM (ingevuld)',
      'form.josmTitle': 'Vereist een draaiende JOSM met afstandsbediening ingeschakeld', 'form.pickOne': 'Kies ten minste één product dat hij verkoopt.', 'form.hoursLong': 'De openingstijden zijn te lang.',
      'form.sendingNote': 'Opmerking versturen…', 'form.noteSent': '✅ Bedankt! {link} aangemaakt. Een mapper voegt de automaat toe.', 'form.noteLink': 'Opmerking #{id}', 'form.noteLinkNoId': 'Opmerking',
      'form.noteFailed': 'De opmerking kon niet worden verstuurd ({msg}).',
      'review.title': 'Controleren voor het uploaden', 'review.intro': 'Er wordt een nieuw knooppunt gemaakt op {coords} met deze tags:', 'review.upload': 'Uploaden naar OpenStreetMap',
      'review.loginUpload': 'Inloggen & uploaden naar OpenStreetMap', 'review.edit': '✏️ Bewerken', 'review.cancel': '✕ Annuleren',
      'review.disclaimer': 'Geüpload met je eigen OSM-account, met de wijzigingenset-opmerking en hashtag {tag}. Voeg alleen automaten toe die je zelf hebt gezien.',
      'review.notConfigured': 'Direct uploaden is op deze site nog niet ingesteld. Gebruik de opmerking of de iD-/JOSM-links.',
      'review.loginFirst': 'Je wordt eerst gevraagd in te loggen bij OpenStreetMap (gratis account).', 'review.checking': 'Inlog controleren…', 'review.as': 'Uploaden als {user}',
      'review.dev': 'op de testserver', 'review.logout': 'uitloggen', 'review.toOsm': 'Je wordt naar OpenStreetMap gebracht om in te loggen…', 'review.uploading': 'Uploaden…',
      'review.dupe1': 'Er staat al een automaat binnen 20 m:', 'review.dupeN': 'Er staan al {n} automaten binnen 20 m:',
      'review.dupeHint': 'Upload alleen als het een andere automaat is.', 'review.dupeView': 'bekijk', 'review.dupeDefault': 'automaat', 'review.thanks': 'Bedankt!',
      'review.added': '✅ Toegevoegd! {node} in {changeset}. Hij staat nu hier en voor iedereen na de volgende nachtelijke update.', 'review.node': 'Knooppunt {id}', 'review.changeset': 'wijzigingenset {id}',
      'review.notUploaded': 'Niet geüpload', 'review.nothingChanged': 'Er is niets gewijzigd op OpenStreetMap. Tik op ＋ om het opnieuw te proberen.', 'review.failed': 'Uploaden mislukt',
      'review.retryLoggedIn': 'Je bent nu ingelogd — tik op ＋ en probeer het opnieuw.',
      'osm.loginCancelled': 'Het inloggen is op OpenStreetMap geannuleerd.', 'osm.stateMismatch': 'Inloggen mislukt (status komt niet overeen) — probeer het opnieuw.',
      'osm.tooLong': 'Het inloggen duurde te lang — probeer het opnieuw.', 'osm.expired': 'Je OSM-login is verlopen — log opnieuw in.',
      'osm.notConfigured': 'Direct uploaden is niet ingesteld (OAuth-client-ID ontbreekt).',
    },
  };

  const KEY = 'vm-lang';
  const base = (tag) => String(tag || '').toLowerCase().split(/[-_]/)[0];
  const browserLangs = [...new Set((navigator.languages || [navigator.language || 'en']).map(base))];

  function pick() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && STRINGS[saved]) return saved;
    } catch { /* ignore */ }
    return browserLangs.find((l) => STRINGS[l]) || 'en';
  }

  let lang = pick();
  const listeners = [];

  function t(key, vars) {
    let s = (STRINGS[lang] && STRINGS[lang][key]);
    if (s == null) s = STRINGS.en[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  /** Same as t(), but returns null instead of the key when there is no translation. */
  function tryT(key) {
    const s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key];
    return s == null ? null : s;
  }

  /** A key's text in every language (for searching in any of them). */
  function tAll(key) {
    return Object.values(STRINGS).map((d) => d[key]).filter((v) => v != null);
  }

  function applyStatic(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }

  function set(code) {
    if (!STRINGS[code] || code === lang) return;
    lang = code;
    try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
    applyStatic();
    listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.error(e); } });
  }

  /** Languages for the picker: the browser's preferred ones first, then the rest. */
  function ordered() {
    const codes = Object.keys(LANGS);
    const pref = browserLangs.filter((l) => LANGS[l]);
    return [...pref, ...codes.filter((c) => !pref.includes(c))].map((c) => Object.assign({ code: c }, LANGS[c]));
  }

  const fmtNum = (n) => Number(n).toLocaleString(lang);

  window.I18N = {
    t, tryT, tAll, set, ordered, fmtNum, applyStatic,
    get lang() { return lang; },
    get info() { return LANGS[lang]; },
    onChange(fn) { listeners.push(fn); },
  };
  applyStatic();
})();
