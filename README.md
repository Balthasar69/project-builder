# Project Builder

Erster Baustein der App aus dem Business- und Projektplan „Be Happy Again"
(Planungsstand 31.08.2026). Diese Version enthält das **Projektcockpit**
mit Reifegrad-Anzeige, Phasenverlauf und dem **Projekt-Check /
GO-NO-GO-Scoring** (Kapitel 11) für das Pilotprojekt Be Happy Again.

## Starten

Die App braucht eine Datenbank (Vercel Postgres) — deshalb zuerst den
Abschnitt **„Online stellen (Vercel)"** weiter unten durchgehen, mindestens
bis Schritt 5. Danach lokal:

```bash
npm install
npm run dev
```

Dann [http://localhost:3000](http://localhost:3000) öffnen.

## Was hier drin ist

- `src/lib/types.ts` — Datenmodell: Phasen (Kapitel 6), Reifegrad-Bereiche
  mit Gewichtung (Kapitel 9), Projekt-Check-Kriterien (Kapitel 11).
- `src/lib/scoring.ts` — Reifegrad-Berechnung und GO/WEITER PRÜFEN/STOPP-Logik.
- `src/lib/data.ts` — Datenzugriff über Postgres (Neon). Jedes Projekt ist
  eine Zeile mit einem JSON-Dokument, statt eines aufwendigen relationalen
  Schemas — passend zum Grundsatz „kleinstes real testbares Produkt"
  (Kapitel 13/28). `src/data/seed.json` ist nur die Startbefüllung für
  `npm run db:init`. Enthält außerdem den Datenzugriff für Konten (`users`).
- `src/lib/session.ts` / `src/lib/auth.ts` — echte Anmeldung: Passwörter
  werden gehasht (bcrypt) gespeichert, die Sitzung liegt in einem signierten
  Cookie (eigene, schlanke Signierung statt einer weiteren Bibliothek, damit
  sie auch in der Middleware/Edge-Runtime läuft).
- `middleware.ts` — leitet ohne gültige Sitzung zur Anmeldung (`/login`) um.
- `src/app/login`, `src/app/register` — Anmeldung und Registrierung, jede
  Person mit eigenem Konto (E-Mail + Passwort).
- `src/app/projects/neu` — neues Projekt anlegen.
- `src/components/` — Phasenanzeige, Reifegrad-Meter, Projekt-Check-Formular,
  Team-Verwaltung (`TeamManager`), Anmelde-/Registrierungsformulare.
- `src/app/projects/[slug]/page.tsx` — das Projektcockpit selbst, inklusive
  Zugriffsprüfung, Team-Verwaltung und Aufgaben.
- `src/lib/bitrix24.ts` — schlanker REST-Client für Bitrix24-Aufgaben und
  -Arbeitsgruppen (`TaskBoard`-Komponente), siehe Abschnitt
  „Bitrix24-Aufgaben" unten.
- `src/lib/email.ts` — schlanker Versand von Einladungs-E-Mails über Resend,
  siehe Abschnitt „E-Mail-Versand" unten.
- `src/components/TaskNotes.tsx` — Text-/Sprachnotizen je Aufgabe
  (Mikrofon-Aufnahme im Browser), gespeichert in der Tabelle `task_notes`.

Be Happy Again ist mit den Eckdaten aus dem bereits eingerichteten
Bitrix24-Deal (#138, Kategorie 4, KULTO GmbH Balthasar) sowie dem
festgelegten Kernteam (Balthasar Fleischmann, Cindy Endres) vorbelegt.

## Registrierung & Zugänge (v0.3)

Statt eines gemeinsamen Passworts fürs ganze Kernteam hat jetzt jede Person
ein eigenes Konto:

- Unter `/register` legt sich jede Person ihr Konto selbst an (Name, E-Mail,
  Passwort). Die **erste** registrierte Person wird automatisch Admin und
  sieht/verwaltet alle Projekte — im Regelfall also Sie selbst, direkt nach
  dem Live-Schalten.
- Ein Projekt ist nur für die Personen sichtbar, deren E-Mail-Adresse in
  seiner Mitgliederliste steht (Admins sehen immer alle Projekte). Diese
  Liste pflegt man im Projekt selbst, im Abschnitt „Team" — einfach die
  E-Mail-Adresse der Person eintragen, mit der sie sich registrieren muss.
- Über „+ Neues Projekt" auf der Startseite legt jede Person beliebig viele
  eigene Projekte an; sie wird dabei automatisch Mitglied und Projektleitung.
  Alle Projekte laufen in derselben App/Datenbank — kein separates
  Vercel-Projekt pro Vorhaben nötig.

Für Be Happy Again sind bereits `balthasar@balthasar-fleischmann.de`
(Balthasar) und `hallo@cindyendres.de` (Cindy) als Mitglieder hinterlegt —
sobald sich beide mit genau dieser E-Mail-Adresse registrieren, sehen sie das
Projekt automatisch. Neue Mitglieder, die über den Abschnitt „Team" im
Projektcockpit hinzugefügt werden, bekommen das seit v0.5 automatisch per
E-Mail mitgeteilt (siehe Abschnitt „E-Mail-Versand" unten).

## Bitrix24-Aufgaben (v0.4)

Bitrix24 bedient jetzt nicht mehr nur das CRM (Deal, Pipeline), sondern auch
das Projektmanagement: im Projektcockpit lässt sich im Abschnitt „Aufgaben"
eine eigene Bitrix24-Arbeitsgruppe für das Projekt anlegen (in jeder Phase
nutzbar, nicht erst ab der Kerngruppen-Phase). Danach lassen sich Aufgaben
direkt in der App anlegen, ansehen und als erledigt markieren — sie leben
aber ganz normal in Bitrix24 und sind dort genauso sichtbar/bearbeitbar wie
gewohnt. Die App speichert dafür nur die ID der Arbeitsgruppe
(`bitrix24.groupId`) im Projekt, keine eigene Aufgabenkopie.

Beim Anlegen der Arbeitsgruppe werden automatisch alle Kernteam-Mitglieder
hinzugefügt, für die eine `bitrix24UserId` gepflegt ist (siehe unten) — so
sehen z. B. Balthasar und Cindy die Arbeitsgruppe und ihre Aufgaben auch
direkt in Bitrix24 selbst, nicht nur über die App.

**Technischer Hinweis:** für Aufgaben nutzt die App bewusst die ältere
Methodenfamilie `task.item.*` statt der neueren `tasks.task.*` — Letztere
verweigert bei einfachen (eingehenden) Webhooks grundsätzlich den Dienst
("The request requires higher privileges than provided by the webhook
token"), offenbar weil sie nur für richtige Bitrix24-Apps (OAuth) gedacht
ist. `sonet_group.*` (Arbeitsgruppen) funktioniert dagegen über Webhooks
einwandfrei.

**Voraussetzung:** derselbe eingehende Webhook, der schon fürs CRM benutzt
wird, braucht zwei zusätzliche Scopes:

1. In Bitrix24 → **Anwendungen** → **Webhooks** → den bestehenden
   eingehenden Webhook öffnen (oder einen neuen anlegen, falls keiner mehr
   zur Hand ist).
2. Bei den Berechtigungen zusätzlich **„Aufgaben und Projekte" (task)** und
   **„Arbeitsgruppen" (sonet_group)** aktivieren, speichern.
3. Die (ggf. neue) Webhook-URL als `BITRIX24_WEBHOOK_URL` in Vercel →
   Settings → Environment Variables eintragen (alle Umgebungen), dann
   `npx vercel env pull .env.local` und `npx vercel --prod`.

Falls Bitrix24 mit „insufficient_scope" oder einem Rechte-Fehler antwortet
(das kam bei der Kernteam-Einrichtung schon einmal vor), fehlt meist genau
einer dieser beiden Scopes — die Fehlermeldung in der App zeigt das direkt
an. Sollte zusätzlich ein Fehler rund um Dateien/Ablage auftauchen, hilft es
oft, am Webhook auch **„Datenablage" (disk)** freizuschalten — Bitrix24
legt zu jeder Arbeitsgruppe automatisch einen Gruppen-Datenordner an.

Aufgaben werden aktuell standardmäßig der Person zugewiesen, die Sie im
Bitrix24-Webhook hinterlegt haben (dafür wird zusätzlich der Scope
**„Nutzer" (user)** benötigt, der meist schon von der CRM-Einrichtung her
aktiv ist), es sei denn, im Kernteam des Projekts ist für ein Mitglied eine
`bitrix24UserId` gepflegt (wie bei Be Happy Again für Balthasar und Cindy) —
dann wird diese Person zuständig.

## Phasenwechsel & Kernteam-Rechte (v0.4.2)

Im Abschnitt „Phasenverlauf" gibt es jetzt einen Knopf **„Weiter zu: …"**,
der ein Projekt eine Stufe im normalen Verlauf weiterschaltet (Kapitel 6).
Vorher ging das nur über ein Terminal-Skript.

Sichtbar ist der Knopf nur für **Kernteam-Mitglieder und Admins** — eine
erste, kleine Rollen-Unterscheidung über die bisherige Mitglied/Admin-Grenze
hinaus: Ein Kernteam-Mitglied braucht dafür eine hinterlegte `email` im
Projekt-Datensatz (`kernteam[].email`), die zu einem registrierten Konto
passt. Neu angelegte Projekte bekommen das automatisch (die anlegende
Person wird mit ihrer E-Mail ins Kernteam eingetragen); bei Be Happy Again
wurde das nachträglich per Skript ergänzt:

```bash
node scripts/set-kernteam-email.mjs be-happy-again "Balthasar Fleischmann" balthasar@balthasar-fleischmann.de
node scripts/set-kernteam-email.mjs be-happy-again "Cindy Endres" hallo@cindyendres.de
```

Künftige Mitwirkende, die nur über `mitglieder` Zugriff auf ein Projekt
haben (nicht `kernteam`), sehen den Knopf nicht — sie können das Projekt
zwar mitbearbeiten (Aufgaben, Projekt-Check, Team), aber nicht die Phase
wechseln. Das ist die Grundlage für die feineren Rollen aus „Nächste
Ausbaustufen" unten.

## Projekt-Check pro Phase, E-Mail-Einladungen, Sprachnotizen (v0.5)

**Projekt-Check pro Phase.** Der Projekt-Check (Kapitel 11, Abschnitt
„Projekt-Check & GO/NO-GO") gehört jetzt zur jeweils aktuellen Phase, statt
projektweit nur eine einzige Bewertung zu kennen. Beim Wechsel in eine neue
Phase startet das Formular leer; die Bewertung der vorherigen Phase(n) bleibt
erhalten und wird unterhalb als kompakte Historie angezeigt
(`checkVerlauf`, jetzt mit `phase`-Feld je Eintrag).

Zusätzlich hat jetzt jede Phase **eigene Bewertungsthemen** statt überall
derselben 10 Fragen: „Idee" fragt z. B. nach Problem, Zielgruppe und Nutzen,
„Business Case" nach Preis, Kosten und Deckungsbeitrag, „Vertrieb" nach
Lead-Prozess und Pipeline-Pflege usw. (siehe
`CHECK_KRITERIEN_NACH_PHASE` in `src/lib/types.ts`). Die Punkteskala (z. B.
„18 / 25") passt sich dabei automatisch an die Anzahl der Fragen der
jeweiligen Phase an.

**E-Mail-Versand.** Wird im Abschnitt „Team" eine neue E-Mail-Adresse
hinzugefügt, verschickt die App automatisch eine Einladungs-Mail (Link zu
`/register` bzw. `/login`, je nachdem ob schon ein Konto besteht). Dafür wird
der Dienst [Resend](https://resend.com) genutzt:

1. Kostenloses Konto auf [resend.com](https://resend.com) anlegen.
2. Im Resend-Dashboard unter **API Keys** einen neuen Key erzeugen und
   kopieren.
3. In Vercel → **Settings** → **Environment Variables** als
   `RESEND_API_KEY` eintragen (alle Umgebungen), dann
   `npx vercel env pull .env.local` und `npx vercel --prod`.

Ohne eigene, bei Resend bestätigte Absender-Domain lässt Resend im
Testmodus (Sandbox) nur Mails an die eigene, bei Resend hinterlegte
E-Mail-Adresse zu — nicht an beliebige Teammitglieder. Für echten Versand an
jede Adresse muss deshalb einmalig eine eigene Domain bei Resend verifiziert
werden (DNS-Einträge beim eigenen Domain-Anbieter, siehe
[resend.com/domains](https://resend.com/domains)); danach `RESEND_FROM_EMAIL`
in Vercel auf eine Adresse dieser Domain setzen (z. B.
`Project Builder <projekt@ihre-domain.de>`) und neu bereitstellen.
Fehlt `RESEND_API_KEY` oder schlägt der Versand fehl, wird die Person
trotzdem ganz normal als Mitglied hinzugefügt; im Team-Bereich erscheint
dann nur ein Hinweis, dass die Mail nicht verschickt werden konnte.

**Sprachnotizen zu Aufgaben.** Jede Aufgabe im Abschnitt „Aufgaben" hat jetzt
einen Bereich „Notizen ▾" zum Auf-/Zuklappen. Dort lassen sich Text- oder
Sprachnotizen hinterlassen (Mikrofon-Aufnahme direkt im Browser, Freigabe
wird beim ersten Mal abgefragt). Die Notizen (inkl. Audiodatei) werden in
einer eigenen Datenbank-Tabelle (`task_notes`) gespeichert — nach dem
Einspielen der neuen Dateien deshalb einmalig
```bash
npx vercel env pull .env.local
npm run db:init
```
ausführen, damit die Tabelle bzw. die neue Spalte `transcript` angelegt wird
(bestehende Daten bleiben unangetastet). Aus technischen Gründen (Obergrenze
für Anfragen an Vercel) sind Sprachaufnahmen auf ca. 30–60 Sekunden begrenzt;
die App bricht sehr lange Aufnahmen automatisch nach 2 Minuten ab und zeigt
bei zu großen Dateien eine klare Fehlermeldung statt eines technischen
Absturzes.

Jede Notiz wird außerdem automatisch als **Kommentar bei der zugehörigen
Bitrix24-Aufgabe** gepostet (über denselben Webhook wie die Aufgaben selbst,
Methode `task.commentitem.add`) — so sehen auch Team-Mitglieder, die nur in
Bitrix24 arbeiten, die Notiz, ohne die App zu öffnen. Die Audiodatei selbst
bleibt bewusst nur im Project Builder (kein Datei-Upload über den Webhook);
in Bitrix24 erscheint bei Sprachnotizen stattdessen der **automatisch
vertextete Text**. Dafür wird ein Whisper-kompatibler Dienst genutzt, wahlweise:

- **[Groq](https://console.groq.com) (empfohlen).** Kostenlose Stufe, **keine
  Zahlungsmethode nötig** (Stand heute: bis 2.000 Anfragen/Tag bzw. 7.200
  Sekunden Audio/Stunde – für Sprachnotizen in diesem Rahmen mehr als
  ausreichend).
  1. Konto auf [console.groq.com](https://console.groq.com) anlegen.
  2. Im Dashboard unter **API Keys** einen neuen Key erzeugen und kopieren.
  3. In Vercel → **Settings** → **Environment Variables** als
     `GROQ_API_KEY` eintragen (alle Umgebungen), dann
     `npx vercel env pull .env.local` und `npx vercel --prod`.
- **[OpenAI](https://platform.openai.com) (Alternative).** Kostenpflichtig
  (Cent-Beträge pro Aufnahme, Zahlungsmethode nötig), als `OPENAI_API_KEY`
  genauso eintragen. Ist `GROQ_API_KEY` gesetzt, hat er Vorrang vor
  `OPENAI_API_KEY`.

Fehlen beide Keys, funktioniert die Wiedergabe der Sprachnotiz weiterhin
ganz normal — nur ohne automatischen Text (in der App als „Nicht
vertextet" markiert, in Bitrix24 mit entsprechendem Hinweistext). Fehlt
`BITRIX24_WEBHOOK_URL` oder schlägt der Bitrix24-Sync fehl, wird die Notiz
ebenfalls trotzdem ganz normal in der App gespeichert; im Notizen-Bereich
erscheint dann nur ein Hinweis.

## Admin-Funktionen: Phase zurücksetzen, Teammitglied entfernen (v0.9)

Zwei Funktionen, die bewusst **nur Admins** (Personen mit `is_admin = true`
in der `users`-Tabelle — die zuerst registrierte Person wird automatisch
Admin) sehen und nutzen können:

- **Phase direkt setzen / zurücksetzen.** Im Abschnitt „Phasenverlauf"
  erscheint für Admins zusätzlich zum normalen „Weiter zu: …"-Knopf ein
  Auswahlfeld mit allen 15 Phasen plus Knopf **„Setzen / Zurücksetzen"**.
  Damit lässt sich jederzeit zu jeder Phase springen — vor oder zurück,
  z. B. um eine versehentlich zu früh geschaltete Phase zu korrigieren.
  Anders als der reguläre „Weiter zu: …"-Knopf (der nur einen Schritt
  vorwärts erlaubt und für alle Kernteam-Mitglieder sichtbar ist) ist dieser
  Sprung bewusst auf Admins beschränkt, weil er auch bereits durchgeführte
  Checks „überspringen" kann.
- **Teammitglied entfernen.** Im Abschnitt „Team" erscheint für Admins
  neben jeder eingetragenen E-Mail-Adresse ein Knopf **„Entfernen"** (mit
  Sicherheitsabfrage). Die Person verliert damit den Zugriff auf das
  Projekt in der App. Bewusst **nicht** automatisch aus dem Kernteam
  entfernt wird dabei niemand — das Kernteam wird separat über
  `scripts/set-kernteam-email.mjs` gepflegt, da es eigene, weitreichendere
  Rechte hat (Phasenwechsel).

Beide Funktionen brauchen keinen neuen Umgebungs-Schlüssel und keine
Datenbank-Änderung — nach dem Deployment (`npx vercel --prod`) sind sie
sofort nutzbar.

## CD-Branding: Logo, Farben, Schrift (v0.10)

Die App trägt jetzt das Logo von **KULTO insightworx – O&K Organisation und
Kommunikation** und ist farblich/schriftlich an dessen CD angeglichen:

- **Logo.** Liegt unter `public/logo.png` und erscheint im Kopfbereich jeder
  Seite (`src/components/Brand.tsx`). Ein neues Logo einsetzen: Datei unter
  genau diesem Pfad/Namen ersetzen, dann neu deployen (`npx vercel --prod`)
  — kein Code muss angepasst werden.
- **Farben.** Die Akzentfarbe (Buttons, Links, Hervorhebungen) wurde von
  Braun auf das Logo-Blau umgestellt (`#0e6eb3`). Die Bewertungsfarben für
  „GO" und „STOPP" (Kapitel 11) nutzen jetzt ebenfalls das Grün bzw. Rot aus
  dem Logo — das passt inhaltlich ohnehin gut zusammen. Alle Farbwerte
  stehen zentral in `tailwind.config.ts`, Abschnitt `colors`.
- **Schrift.** Die bisherige Zierschrift „Fraunces" für Überschriften wurde
  durch dieselbe klare, serifenlose Schrift wie im übrigen Text ersetzt
  (IBM Plex Sans) — das wirkt nüchterner/„geschäftsmäßiger", passend zum
  schlichten Logo-Schriftbild.

Nicht angepasst (auf Wunsch nachträglich möglich): der App-Name/Titel im
Browser-Tab (bleibt „Project Builder") sowie das Browser-Tab-Icon
(Favicon).

## Projektbeschreibung & Kurzanweisungen (v0.11)

**Projektbeschreibung.** Jedes Projekt kann jetzt einen frei formulierten
Beschreibungstext haben ("Worum geht es?"), der allen Teammitgliedern direkt
unter dem Projektnamen angezeigt wird. Beim Anlegen eines neuen Projekts ist
das Feld optional mit dabei; danach können Kernteam-Mitglieder und Admins
sie im Projektcockpit jederzeit über „Bearbeiten" ändern (Knopf erscheint
nur für sie).

**Kurzanweisungen pro Block.** Unter jeder Überschrift im Projektcockpit
(„Reifegrad je Bereich", „Phasenverlauf", „Kernteam", „Team", „Aufgaben",
„Projekt-Check & GO/NO-GO") steht ein kurzer Erklärsatz, der Teammitgliedern
zeigt, wofür der Bereich da ist und was sie dort tun können.

## Individuelle Kurzanweisungen & grafischer Projektfortschritt (v0.12)

**Individuelle Kurzanweisungen.** Die Kurzanweisungen aus v0.11 waren fest
im Code hinterlegt und für alle Projekte gleich. Jetzt kann jedes Projekt
eigene, individuelle Texte je Block bekommen: Kernteam-Mitglieder und
Admins sehen unter jedem Erklärsatz einen „Bearbeiten"-Link, tragen dort
ihren eigenen Text ein und speichern. Ohne eigenen Text erscheint weiterhin
automatisch der allgemeine Standardtext (`STANDARD_HINWEISE` in
`src/lib/types.ts`) — über „Standardtext verwenden" beim Bearbeiten lässt
sich ein individueller Text auch wieder löschen.

**Grafischer Projektfortschritt.** Oben im Projektcockpit, direkt unter der
Projektbeschreibung, steht jetzt eine Ring-Grafik wie eine Zielscheibe: ein
Ring pro Phase, ineinander verschachtelt — der innerste Ring ist Phase 1
(„Idee"), jede weitere Phase kommt als eigener Ring nach außen dazu, bis
zur äußersten Phase 14 („Skalierung"). Jede Phase hat eine eigene, feste
Farbe; bereits erreichte Phasen sind volltonig eingefärbt, die aktuelle
Phase zusätzlich etwas dicker, noch offene Phasen erscheinen blass. In der
Mitte steht der Gesamt-Reifegrad (Kapitel 9) als Prozentzahl. Ist das
Projekt geparkt, zeigt die Grafik statt einer Phase den Hinweis „Projekt
ist aktuell geparkt".

## Bewertungsrecht & Kernteam-Verwaltung (v0.13)

**Nur noch Kernteam bewertet.** Bisher konnte jede Person mit App-Zugriff
(„Team") den Projekt-Check ausfüllen. Jetzt dürfen nur noch
**Kernteam-Mitglieder und Admins** bewerten — wie beim Phasenwechsel.
Normale Teammitglieder sehen im Bereich „Projekt-Check & GO/NO-GO"
weiterhin das Ergebnis (Score, GO/WEITER/STOPP, frühere Bewertungen), aber
kein Eingabeformular mehr, sondern einen Hinweistext.

**Kernteam direkt in der App verwalten.** Damit das nicht dazu führt, dass
nur noch eine einzige Person bewerten darf, kann das Kernteam jetzt direkt
im Projektcockpit gepflegt werden, ohne Terminal-Skript
(`set-kernteam-email.mjs` bleibt als Alternative bestehen). Im Bereich
„Kernteam" sehen **Admins** zusätzlich zur Liste ein kleines Formular
(Name, Rolle, E-Mail) zum Hinzufügen sowie einen „Entfernen"-Knopf pro
Person. Eine neu hinzugefügte Person wird automatisch auch als
Team-Mitglied eingetragen (sonst könnte sie sich gar nicht anmelden) und
bekommt eine Einladungs-E-Mail, falls sie noch kein Konto hat.

## Benachrichtigung beim Entfernen (v0.14)

Wird eine Person aus „Team" oder aus dem „Kernteam" entfernt, bekommt sie
das jetzt automatisch per E-Mail mitgeteilt (bisher gab es nur beim
Hinzufügen eine Mail):

- **Aus „Team" entfernt:** „Dein Zugriff auf … wurde entfernt" — die Person
  verliert den kompletten Zugriff auf dieses Projekt.
- **Aus „Kernteam" entfernt:** „Du bist nicht mehr im Kernteam von …" — der
  normale Projekt-Zugriff bleibt bestehen, nur Phasenwechsel und Bewertung
  gehen nicht mehr.

Wie beim Einladen gilt: Der E-Mail-Versand darf das Entfernen selbst nie
verhindern. Schlägt er fehl (z. B. weil `RESEND_API_KEY` fehlt), wird die
Person trotzdem entfernt, nur mit einem entsprechenden Hinweis in der App.

## Individuelle Bewertungsreihen je Kernteam-Mitglied (v0.15)

Bisher gab es pro Phase eine einzige, geteilte Bewertung – wer zuletzt
speicherte, überschrieb die Eingaben der anderen. Jetzt bewertet **jedes
Kernteam-Mitglied unabhängig**, und alle Bewertungen bleiben gleichzeitig
sichtbar:

- Unter jeder Frage im Projekt-Check steht jetzt eine eigene Zeile pro
  Kernteam-Mitglied (Name vorangestellt), mit der 1–5-Skala. Nur die
  eigene Zeile ist bedienbar (blau hervorgehoben); die Zeilen der anderen
  zeigen deren zuletzt abgegebene Bewertung nur lesend an (grau, oder
  blass, wenn diese Person die Frage noch nicht beantwortet hat).
- Der **gemeinsame Project Score** ist jetzt der Durchschnitt aller
  abgegebenen Bewertungen je Frage, daraus wird wie gehabt GO / WEITER
  PRÜFEN / STOPP abgeleitet (Kapitel 11). Zusätzlich sieht jede Person
  ihre eigene Zwischensumme.
- „Frühere Bewertungen anderer Phasen" zeigt ebenfalls den Durchschnitt je
  Phase, plus Anzahl der Bewertungen.
- Nur Personen mit E-Mail-Adresse im Kernteam (siehe Kernteam-Verwaltung,
  v0.13) bekommen eine eigene Bewertungsreihe, da nur sie sich anmelden
  können.

## Fehlerbehebung: Kernteam ohne Team-Zugriff (v0.16)

Es kam vor, dass eine Person im „Kernteam" stand, aber nicht (mehr) unter
„Team" – z. B. weil sie nur aus „Team" entfernt wurde, ohne auch aus dem
Kernteam entfernt zu werden (das war in v0.13–v0.15 bewusst getrennt), oder
weil sie ursprünglich über das ältere Terminal-Skript
`set-kernteam-email.mjs` ins Kernteam kam. Ohne „Team"-Eintrag bekam die
Person beim Öffnen des Projekts fälschlich „Kein Zugriff" zu sehen, obwohl
sie im Kernteam stand. Zwei Korrekturen:

1. **Zugriffsprüfung repariert:** Kernteam-Mitglieder haben jetzt immer
   Zugriff auf das Projekt, auch falls sie (noch) nicht in `mitglieder`
   stehen (`hatProjektZugriff` in `src/lib/auth.ts`).
2. **„Team entfernen" entfernt jetzt konsequent auch aus dem Kernteam.**
   Wer komplett aus einem Projekt entfernt wird, verliert damit auch
   automatisch seine Kernteam-Rechte, statt inkonsistent im Kernteam
   stehen zu bleiben. Wer nur die Kernteam-Rechte entziehen möchte (Zugriff
   bleibt bestehen), nutzt weiterhin gezielt „Entfernen" im Kernteam-
   Bereich, nicht unter „Team".

Bereits bestehende, davon betroffene Personen (wie im aktuellen Fall)
brauchen keine manuelle Korrektur mehr – Punkt 1 behebt das automatisch,
sobald diese Version live ist.

## Benachrichtigungen bei Änderungen im Projekt (v0.17)

Das Kernteam eines Projekts bekommt jetzt automatisch eine E-Mail bei vier
Arten von Änderungen (jeweils an alle Kernteam-Mitglieder mit hinterlegter
E-Mail-Adresse, außer an die Person, die die Änderung selbst gemacht hat):

- **Neue Bewertung** im Projekt-Check (Score, Empfehlung, Phase).
- **Phasenwechsel** (auch beim Admin-„Setzen/Zurücksetzen").
- **Neue Text-/Sprachnotiz** zu einer Aufgabe (mit Text bzw. Vertextung).
- **Aufgabe erledigt**.

Wie bei allen bisherigen Benachrichtigungen gilt: Der E-Mail-Versand darf
die eigentliche Aktion nie verhindern oder verzögert scheitern lassen –
schlägt er fehl, passiert die Aktion trotzdem ganz normal, nur ohne
Benachrichtigung. Es gibt aktuell keine Möglichkeit, einzelne
Benachrichtigungsarten pro Person ab-/anzuschalten; das wäre eine spätere
Ausbaustufe.

## Bitrix24-Statusanzeige bei Aufgaben (v0.18, korrigiert in v0.19)

Jede Aufgabe zeigt in der Aufgabenliste jetzt zusätzlich ein kleines Label
mit ihrem Bitrix24-Status – in derselben Zeile, direkt vor dem
„Notizen"-Knopf. Das sind dieselben Spalten-Namen, die Bitrix24 in seiner
eigenen Kanban-Ansicht für Aufgaben verwendet:

- Neu
- In Arbeit
- Zur Kontrolle
- Erledigt
- Aufgeschoben
- Abgelehnt

Der Status kommt live von Bitrix24 mit (kein eigener Zwischenspeicher) –
egal ob eine Aufgabe hier in der App oder direkt in Bitrix24 angelegt bzw.
bearbeitet wurde, steht immer der aktuelle Stand da.

**Entfernt in v0.20:** Der eigene „Erledigt"-Knopf in der App wurde
entfernt – der Bitrix24-Status wird jetzt ausschließlich in Bitrix24
selbst gepflegt (z. B. per Drag & Drop im Kanban) und hier nur noch
angezeigt. Die durchgestrichene Schrift für bereits fertige Aufgaben
bleibt als reine Anzeige bestehen. Dadurch verschickt die App die
Benachrichtigung „Aufgabe erledigt" (siehe v0.17) aktuell nicht mehr,
da es keine entsprechende Aktion in der App mehr gibt, die sie auslösen
könnte.

**Sortierung wie in Bitrix24 (v0.21):** Die Aufgabenliste ist nach
denselben Gruppen sortiert, in denen Bitrix24 sie im Kanban-Board
nebeneinander als Spalten zeigt – von links nach rechts gelesen.

**Echte Bitrix24-Spalten statt geratenem Status (v0.22):** Die App liest
jetzt direkt die selbst benannten Kanban-Spalten aus Bitrix24 aus (Name,
Farbe und Reihenfolge, genau wie in der jeweiligen Arbeitsgruppe
konfiguriert) – nicht mehr nur den alten, technischen Status. Ein
gemeinsamer Praxistest hat gezeigt: Der alte Status wird beim Verschieben
einer Aufgabe per Drag & Drop in Bitrix24 nicht zuverlässig mitgepflegt,
während das eigentliche Spalten-Feld immer stimmt. Die App zeigt deshalb
jetzt für jede Aufgabe genau die Spalte, in der sie in Bitrix24 auch
wirklich liegt, inklusive der dort hinterlegten Farbe. Nur bei Aufgaben,
die noch nie manuell in eine Spalte gezogen wurden, wird die Spalte anhand
des technischen Status geschätzt (fertige Aufgaben in die Spalte, die wie
„Erledigt" heißt, alle anderen in die als Standard-Spalte markierte
„Neu"-Spalte) – das betrifft in der Praxis nur ganz frische, noch nicht
angefasste Aufgaben. Hat eine Arbeitsgruppe (noch) gar keine eigenen
Spalten eingerichtet, zeigt die App wie bisher ersatzweise den technischen
Status.

Technischer Hintergrund: Zum Lesen der Aufgabenliste nutzt die App dafür
jetzt zusätzlich die neuere Bitrix24-Schnittstelle "tasks.task.list" (nur
zum Lesen – zum Anlegen und Erledigen von Aufgaben bleibt es bei der
älteren, garantiert erlaubten Schnittstelle). Ein extra angelegtes
Diagnose-Skript (`scripts/debug-bitrix-status.mjs`) hat das vorab mit
echten Daten bestätigt.

**Reihenfolge im Projektcockpit (v0.23):** Der Abschnitt „Aufgaben" steht
jetzt unter „Projekt-Check & GO/NO-GO" (dem Bewertungsmodul), statt davor.

**Layout im Projektcockpit (v0.24):** Kernteam und Team stehen jetzt
nebeneinander, auf einer Höhe (links Kernteam, rechts Team) – und direkt
über der grafischen Projektfortschritts-Darstellung, statt weiter unten
untereinander. Außerdem sind Logo und Schrift im Kopfbereich des
Projektcockpits größer als zuvor (nur dort – auf Login, Registrierung und
der Projektübersicht bleibt das Logo in der bisherigen Größe).

**Korrektur: Überlappende Felder im Kernteam-Formular (v0.25):** Durch die
neue, schmalere Spaltenbreite aus v0.24 wurden die drei Eingabefelder
("Name", "Rolle", "E-Mail-Adresse") und der Knopf "Hinzufügen" im
Kernteam-Formular auf breiteren Bildschirmen in einer Zeile nebeneinander
angeordnet – das passte in die alte volle Breite, ist aber zu breit für die
jetzt halbe Spaltenbreite und lief dadurch optisch in die Team-Spalte
hinein. Das Kernteam-Formular steht jetzt immer untereinander
(Zeile für Zeile), unabhängig von der Bildschirmbreite.

**Kurzeinleitung im Projektcockpit (v0.26):** Direkt unter der Kopfzeile
("Projektcockpit") steht jetzt ein kurzer, immer gleicher Erklärtext –
unabhängig vom jeweiligen Projekt. Er beschreibt kurz die Handhabung (Phase,
Team und Aufgaben auf einen Blick, Status als Grundlage für die Jourfixe)
und die Funktion (der Project Builder bündelt Phase, Team, Bewertung und
Aufgaben; die Aufgaben kommen automatisch aus Bitrix24, wo das
Tagesgeschäft im Detail läuft). Der Text ist bewusst nicht projektspezifisch
editierbar (kein "Bearbeiten"-Knopf wie bei den anderen Kurzanweisungen),
da er für alle Projekte identisch gelten soll.

**Neuer Bereich "Ideen" (v0.27):** Unter "Aufgaben" gibt es jetzt einen
eigenen Bereich "Ideen" – ein loses Sammelbecken für kurze Gedanken, bevor
sie eine richtige Aufgabe werden. Nur das Kernteam kann Ideen eintragen
oder entfernen (alle mit Projektzugriff sehen die Liste). Eine Idee bleibt
zunächst nur in der App gespeichert, taucht also nicht automatisch in
Bitrix24 auf. Erst wenn das Kernteam bei einer Idee auf "In Bitrix24
übernehmen" klickt, wird daraus eine echte Bitrix24-Aufgabe (mit derselben
automatischen Zuordnung wie beim bisherigen "Aufgabe hinzufügen" im
Aufgaben-Bereich) – ab dann taucht sie ganz normal, mit echtem
Bitrix24-Status, im Aufgaben-Bereich auf. So bleibt "Ideen" ein loses
Sammelbecken für Rohgedanken, während "Aufgaben" weiterhin 1:1 der
Wahrheit aus Bitrix24 folgt.

**Neue Aufgabe jetzt oben (v0.28):** Das Eingabefeld "Neue Aufgabe…" im
Aufgaben-Bereich steht jetzt direkt unter der Überschrift "Aufgaben", statt
ganz unten unter der Liste.

**Einladenderer Platzhaltertext (v0.29):** Der Platzhaltertext im
Eingabefeld für neue Aufgaben lautet jetzt "Hast du eine neue Idee? Dann
gib ihr einen Titel und füge sie hinzu." statt schlicht "Neue Aufgabe…".

**Korrektur: Sprachnotiz nach dem Speichern nicht sichtbar (v0.30):** Bei
Sprachnotizen dauert das Speichern durch Vertextung, Bitrix24-Kommentar und
E-Mail-Benachrichtigung spürbar länger als bei reinen Textnotizen. Dabei
zeigte ein erneuter Abruf der Notizliste direkt nach dem Speichern die
gerade gespeicherte Notiz nicht immer zuverlässig an – sie war zwar
korrekt gespeichert (nach einem Neuladen der Seite war sie da), aber ohne
Neuladen unsichtbar. Behoben: Die neue Notiz wird jetzt direkt aus der
Antwort des Speicherns in die Liste übernommen, statt auf einen zweiten
Abruf zu warten – sie erscheint dadurch sofort.

**Vergangene Bewertungen einsehen (v0.31):** Im Phasenverlauf im
Projektcockpit lässt sich jetzt jede Phase anklicken (auch bereits
erledigte oder die aktuelle) – darunter klappt dann die vollständige
Bewertung dieser Phase auf: jede Frage einzeln, mit der Antwort jedes
einzelnen Kernteam-Mitglieds, dem gemeinsamen Score samt Empfehlung
(GO / WEITER PRÜFEN / STOPP) und etwaigen Notizen dazu – exakt wie im
aktiven Projekt-Check, nur ohne jede Möglichkeit, etwas zu verändern.
Das steht allen mit Zugriff auf das Projekt offen, unabhängig davon, wer
bewerten darf. Das Setzen oder Zurücksetzen der Phase selbst bleibt davon
komplett unberührt weiterhin ausschließlich Sache der Administratoren.
Nochmals anklicken schließt die Ansicht wieder.

**Korrektur: Fehlgeschlagener Online-Bau durch alte Sicherungsordner
(v0.32):** Nach v0.31 zeigte "project-builder-psi.vercel.app" trotz
erfolgreicher Meldung im Terminal weiterhin die alte, nicht anklickbare
Phasenübersicht. Ursache: Die bei früheren Updates automatisch angelegten
Sicherungsordner ("_to_delete/…", mit alten Kopien des gesamten
Programms) lagen weiterhin im Projektordner und wurden von Vercel beim
Bauen versehentlich mitgeprüft – eine darin enthaltene, veraltete Datei
passte nicht mehr zum neuen Phasenverlauf-Baustein, wodurch der Bau
insgesamt abbrach und Vercel stattdessen weiter die letzte funktionierende
(alte) Version auslieferte. Der Projektordner ist jetzt so eingestellt,
dass der Inhalt von "_to_delete" beim Online-Stellen grundsätzlich
ignoriert wird – das verhindert dieses Problem auch bei künftigen
Updates dauerhaft.

**Schnellzugriff-Leiste im Projektcockpit (v0.33):** Direkt unter der
Projektbeschreibung stehen jetzt vier Buttons nebeneinander, die auf einen
Blick zeigen, worum es im Projektcockpit geht, und beim Klick direkt zum
jeweiligen Bereich weiter unten auf derselben Seite springen:

- "Wo stehen wir" → Phasenverlauf
- "Wie sehen wir uns" → Bewertung (Projekt-Check &amp; GO/NO-GO)
- "Was ist zu tun" → Aufgaben
- "Was ich denke und zu tun ist" → Ideen

Die eigentlichen Bereiche selbst sind unverändert – die Buttons sind reine
Sprungmarken, kein neuer Inhalt.

**Automatische Veröffentlichung eingerichtet (ab v0.34):** Das Projekt ist
jetzt mit einem GitHub-Repository verbunden, das wiederum mit Vercel
verknüpft ist. Änderungen werden ab sofort automatisch veröffentlicht,
sobald sie hochgeladen werden – der bisherige Terminal-Befehl
(`npx vercel --prod`) ist dafür nicht mehr nötig.

**Hinweistext bei unvollständiger Bewertung (v0.34):** Der Knopf „Meine
Bewertung speichern" im Projekt-Check ist erst klickbar, wenn alle Fragen
oben beantwortet wurden – eine Notiz allein reicht nicht aus, da eine
Bewertung im Sinne der App immer alle Kriterien umfasst. Damit das nicht
wie ein Fehler wirkt, steht jetzt direkt unter dem ausgegrauten Knopf ein
kurzer Hinweis: „Bitte erst alle 5 Fragen oben beantworten, um speichern
zu können."

**Korrektur: Blockierte automatische Veröffentlichung (v0.34):** Der
allererste automatische Bau nach der Einrichtung in v0.34 wurde von Vercel
mit „Deployment Blocked" abgewiesen, weil die technisch hinterlegte
Autoren-E-Mail-Adresse der Änderungen zu keinem bei GitHub bestätigten
Konto passte. Das ist jetzt korrigiert (die Änderungen tragen seither die
zum GitHub-Konto gehörende, automatisch vergebene „noreply"-Adresse als
Autor) – betrifft nur die technische Kennzeichnung der Änderungen, keine
sichtbare Funktion.

**Mit KI bearbeiten: Hilfestellung zu einzelnen Aufgaben (v0.35):** Jede
Aufgabe im Abschnitt „Aufgaben" hat jetzt – neben „Notizen ▾" – einen
zweiten Bereich zum Auf-/Zuklappen: „Mit KI bearbeiten ▾". Ein Klick auf
„Jetzt von Claude einschätzen lassen" schickt den Aufgabentitel zusammen
mit dem Projektnamen, der Projektbeschreibung und der aktuellen
Projektphase an Claude (Anthropic) und zeigt darunter eine kurze,
konkrete Hilfestellung in normaler Sprache an: wie sich die Aufgabe
einfacher bzw. schneller erledigen lässt und wofür sie gerade im
Zusammenhang mit dieser Projektphase nützlich ist. Die Einschätzung wird
im Projekt gespeichert und bleibt beim nächsten Öffnen der Seite sichtbar;
über „Neu einschätzen lassen" lässt sie sich jederzeit ersetzen. Es ist
ausdrücklich ein Denkanstoß, keine verbindliche Aussage.

Dafür wird — genau wie bei der Vertextung von Sprachnotizen weiter oben —
einer von zwei austauschbaren Anbietern genutzt:

- **[Groq](https://console.groq.com) (empfohlen, kostenlos).** Ist bereits
  ein `GROQ_API_KEY` hinterlegt (weil Sprachnotizen eingerichtet wurden),
  funktioniert „Mit KI bearbeiten" damit automatisch mit — **ohne dass
  irgendetwas zusätzlich eingerichtet werden muss.** Falls noch kein Key
  vorhanden ist: Konto auf [console.groq.com](https://console.groq.com)
  anlegen (keine Zahlungsmethode nötig), im Dashboard unter **API Keys**
  einen neuen Key erzeugen und in Vercel → **Settings** →
  **Environment Variables** als `GROQ_API_KEY` eintragen (alle Umgebungen).
- **[Anthropic/Claude](https://console.anthropic.com) (Alternative,
  kostenpflichtig).** Cent-Beträge pro Anfrage, Zahlungsmethode nötig. Konto
  anlegen, im Dashboard unter **API Keys** einen neuen Key erzeugen
  (beginnt mit `sk-ant-`) und in Vercel als `ANTHROPIC_API_KEY` eintragen.
  Ist `GROQ_API_KEY` gesetzt, hat er Vorrang (kostenlos); `ANTHROPIC_API_KEY`
  greift nur, wenn kein `GROQ_API_KEY` vorhanden ist oder Groq gerade
  keine Antwort liefert.

Nach dem Eintragen eines neuen Schlüssels einmal auf „Redeploy" klicken
(Vercel → Reiter **Deployments** → bei der obersten, aktuellen
Bereitstellung die drei Punkte → „Redeploy"), damit er in der laufenden App
ankommt.

Fehlen beide Schlüssel oder lehnt der jeweilige Dienst eine Anfrage ab (z. B.
wegen aufgebrauchtem Guthaben oder kurzzeitiger Überlastung), erscheint an
dieser Stelle lediglich eine klare Fehlermeldung – der Rest der App
(Aufgaben, Notizen, Bewertung usw.) funktioniert davon vollkommen unberührt
weiter.

**Abmelden im Projektcockpit (v0.36):** Der Knopf „Abmelden" (bisher nur
auf der Projektübersicht) steht jetzt auch oben im Projektcockpit selbst,
direkt neben „← Alle Projekte" — vorher musste man dafür erst zur
Übersicht zurück.

**Bearbeitung schließen (v0.36):** Der aufgeklappte „Mit KI bearbeiten"-
Bereich einer Aufgabe hat jetzt ganz unten einen zusätzlichen Link
„Bearbeitung schließen", der ihn wieder einklappt (zusätzlich zum
Umschalten über den Kopf-Button selbst).

**Balthasar automatisch in jedem Projekt als Admin/Kernteam (v0.36):**
Zwei Ergänzungen sorgen dafür, dass die E-Mail-Adresse
`management@balthasar-fleischmann.de` grundsätzlich in jedem Projekt volle
Rechte hat — unabhängig davon, wer das Projekt angelegt hat oder mit
welchem (ggf. neu registrierten Test-)Konto man gerade angemeldet ist:

- Diese E-Mail-Adresse bekommt beim Anmelden/Registrieren automatisch
  Admin-Rechte, unabhängig vom „is_admin"-Feld in der Datenbank
  (`effektiverAdminStatus` in `src/lib/auth.ts`).
- Sie wird beim Öffnen jedes Projekts automatisch ins Kernteam und in die
  Mitgliederliste ergänzt, falls sie dort noch fehlt (`normalizeProject` in
  `src/lib/data.ts`) — das betrifft auch schon bestehende, ältere Projekte,
  nicht nur neu angelegte. Eine eigene Datenbank-Migration ist dafür nicht
  nötig; sobald ein Projekt danach ohnehin einmal gespeichert wird, landet
  die Ergänzung automatisch dauerhaft in der Datenbank.

Wird diese E-Mail versehentlich aus dem Kernteam eines Projekts entfernt,
erscheint sie beim nächsten Öffnen der Seite automatisch wieder — das ist
so gewollt, kann aber verwirren, falls das nicht erwartet wird.

**Nur Namen anzeigen, Details per Klick für Admins (v0.39):** Im Team wird
seitdem — sofern die Person bereits ein eigenes Konto hat — ihr Name statt
der rohen E-Mail-Adresse angezeigt; ohne eigenes Konto bleibt die
E-Mail-Adresse die einzig bekannte Bezeichnung.

**Korrektur: Rolle bleibt sichtbar, E-Mail per Klick oder Drüberfahren
(v0.40):** In v0.39 wurde im Kernteam versehentlich auch die Rolle
ausgeblendet. Jetzt zeigen Kernteam und Team wie gewünscht Name und Rolle
(Kernteam) immer an — nur die E-Mail-Adresse bleibt standardmäßig
verborgen. Admins können sie auf zwei Arten einblenden: mit der Maus über
den Namen fahren (blendet sich beim Wegfahren automatisch wieder aus) oder
auf den Namen klicken (bleibt dauerhaft sichtbar, bis erneut geklickt
wird).

**Korrektur: Team-Namen auch ohne eigenes Konto (v0.41):** Im Team wurde
der Name einer Person bisher nur angezeigt, wenn sie bereits ein eigenes
Konto hatte. Steht dieselbe E-Mail-Adresse aber schon mit Namen im
Kernteam des Projekts, wird jetzt zusätzlich dieser Name verwendet — die
rohe E-Mail-Adresse erscheint im Team nur noch, wenn wirklich nirgendwo
ein Name dazu bekannt ist.

**Aufgaben von der KI vorschlagen lassen (v0.42):** Im Bereich „Aufgaben"
steht jetzt ein neuer, rein optionaler Knopf „Aufgaben von der KI
vorschlagen lassen" (nur für Admins sichtbar) — sowohl bei bestehenden
Projekten nutzbar als auch immer wieder erneut für dasselbe Projekt.

Der Ablauf:

1. **Admin bestimmt den Projektleiter.** Ausgewählt wird eine Person aus
   dem Kernteam — das kann auch der Admin selbst sein.
2. **Diese Person beantwortet drei kurze Fragen** direkt im
   Projektcockpit (kein E-Mail-Versand nötig — wer das Projekt öffnet,
   während die Fragen noch offen sind, sieht stattdessen den Hinweis
   „Fragebogen offen für … — wartet auf Antwort"):
   - Ist dies ein Geschäftsprojekt oder ein privates/persönliches Projekt?
   - Zielsituation: Was soll am Ende erreicht sein? (bei Geschäftsprojekten
     zusätzlich: Umsatzziel und aktuelle/geplante Liquiditätslage)
   - Meilensteine (ein Meilenstein pro Zeile).
3. **Die KI leitet daraus 5 bis 10 konkrete Zwischenaufgaben ab** —
   genau wie bei „Mit KI bearbeiten" bevorzugt über den kostenlosen
   Groq-Zugang, ersatzweise über Claude/Anthropic, falls vorhanden (siehe
   oben; dieselben Umgebungsvariablen `GROQ_API_KEY`/`ANTHROPIC_API_KEY`
   werden hier mitgenutzt). Bei Geschäftsprojekten ist dabei ausdrücklich
   mindestens eine Aufgabe zur Umsatzgenerierung und eine zur
   Liquiditätsplanung mit dabei.
4. **Die Vorschläge erscheinen zur Durchsicht**, nicht automatisch als
   fertige Aufgaben — das gesamte Kernteam kann jeden Vorschlag vor der
   Übernahme noch am Titel anpassen, einzeln „Übernehmen" (wird zu einer
   echten Bitrix24-Aufgabe, genau wie bei „Ideen") oder „Verwerfen".
   Schlägt die KI-Generierung fehl (z. B. Anbieter überlastet), bleiben die
   Antworten erhalten und lassen sich über „Erneut versuchen" erneut
   verarbeiten.

Der Admin kann eine laufende Runde jederzeit über „Fragebogen abbrechen"
bzw. nach der Durchsicht über „Fertig, ausblenden" beenden.

**Anordnung: Projektbeschreibung und KI-Fragen jetzt unter Team (v0.43):**
Die Projektbeschreibung und der Bereich „Aufgaben von der KI vorschlagen
lassen" standen bisher an unterschiedlichen Stellen der Seite (die
Beschreibung ganz oben unter dem Projektnamen, die KI-Fragen weiter unten
im Aufgaben-Bereich). Beide stehen jetzt zusammen direkt unter
Kernteam/Team, bevor es weiter unten um Fortschritt, Bewertung und
Aufgaben geht.

**KI berücksichtigt bei den Fragen zum Projektstart bereits vorhandene
Aufgaben (v0.44):** Der Fragebogen „Aufgaben von der KI vorschlagen lassen"
(siehe v0.42) steht von Anfang an auf jedem Projekt zur Verfügung — auch
auf bereits länger laufenden, bestehenden Projekten, nicht nur auf gerade
neu angelegten. Bisher wusste die KI bei einem bestehenden Projekt aber
nicht, welche Aufgaben in Bitrix24 schon existieren, und konnte dadurch
Titel vorschlagen, die es inhaltlich schon gab. Jetzt liest die App vor der
KI-Anfrage die aktuell in Bitrix24 hinterlegten Aufgaben dieses Projekts
mit (Titel und ob bereits erledigt) und gibt sie der KI als Kontext mit der
ausdrücklichen Anweisung mit, nichts davon doppelt vorzuschlagen, sondern
gezielt zu ergänzen, was zum Erreichen der genannten Meilensteine noch
fehlt. Ist Bitrix24 gerade nicht erreichbar oder das Projekt (noch) mit
keiner Arbeitsgruppe verbunden, wird ganz normal ohne diesen Zusatz
weitergemacht — die Generierung bricht deswegen nicht ab.

**Korrektur: Projektbeschreibung wieder direkt unter dem Projektnamen
(v0.45):** In v0.43 stand die Projektbeschreibung zusammen mit den
KI-Fragen zum Projektstart unter Kernteam/Team. Die Projektbeschreibung
steht jetzt wieder direkt unter dem Projektnamen, ganz oben auf der Seite
— die KI-Fragen zum Projektstart bleiben wie in v0.43 unter Kernteam/Team.

**Neues Projektcockpit-Layout: Hub-Navigation, Kompetenzen, Chat und
persönlicher KI-Hinweis (v0.46):** Größere Überarbeitung des
Projektcockpits, basierend auf einer gemeinsam abgestimmten Bildschirm-Serie
(Mockups):

- **Logo.** Die Zeile "KULTO" wurde aus dem Logo entfernt (`public/logo.png`)
  — die App trägt jetzt "insightworx – O&K Organisation und Kommunikation",
  Text neu zentriert neben dem unveränderten Icon.
- **Die drei Logo-Farben stärker im Design.** Blau, Rot und Grün aus dem
  Logo-Icon (exakt `#006fc0` / `#be0000` / `#8cc63e`) werden jetzt nicht nur
  für GO/STOPP-Bewertungen verwendet, sondern durchgängig im Cockpit: die
  Phasen-Ringe (großer Fortschritts-Ring wie auch der neue kompakte Ring
  oben) wechseln der Reihe nach durch diese drei Farben, und die drei neuen
  Hub-Spalten Orga/Dashboard/Dynamik sind entsprechend eingefärbt.
- **Titel + kompakter Reifegrad-Ring.** Direkt neben Projektname und
  Kurzbeschreibung steht jetzt ein kleiner Ring mit dem Gesamt-Reifegrad;
  die Prozentzahl steht bewusst UNTER dem Ring statt darin (bei vielen
  ineinander verschachtelten Phasen-Ringen war die Mitte zu klein für eine
  gut lesbare Zahl — das wurde beim großen Fortschritts-Ring weiter unten
  ebenfalls so korrigiert).
- **Persönlicher KI-Hinweis "Für dich als Nächstes".** Ganz oben, noch vor
  der Hub-Navigation, fasst die KI für die angemeldete Person zusammen, was
  als Nächstes zu tun oder anzuschauen ist — ein kurzer Satz plus 2–3
  konkrete Punkte, abgeleitet aus Rolle, eigenem Kompetenzen-Eintrag, Phase/
  Reifegrad/letzter Bewertung, offenen Bitrix24-Aufgaben, Ideen und
  Chat-Aktivität. Nutzt dieselbe KI-Anbieterkette wie die Aufgaben-
  Vorschläge (Groq, ersatzweise Claude) und blendet sich bei einem Fehler
  einfach aus, ohne die restliche Seite zu stören.
- **Hub-Navigation mit drei Spalten.** Die frühere 4er-Kachelreihe
  ("Schnellzugriff") ist einer kompakten Übersicht mit drei schmalen Spalten
  gewichen — Orga (Kernteam, Team, Kompetenzen), Dashboard (Fortschritt,
  Phasen, Bewertung) und Dynamik (Aufgaben, Ideen, Chat). Alle neun Punkte
  sind sofort sichtbar; ein Tipp auf einen Punkt springt direkt zum
  jeweiligen, bereits vollständig auf der Seite vorhandenen Bereich.
- **Neu: Kompetenzen.** Jede Person mit Projektzugriff trägt für sich selbst
  ein, was sie zum Projekt beitragen kann und was sie gerne beitragen
  möchte — reine Selbstauskunft, jede Person sieht und bearbeitet nur ihren
  eigenen Eintrag, die Einträge der anderen werden nur gelesen.
- **Neu: Chat.** Interner Team-Chat je Projekt, nur für Kernteam & Team
  dieses Projekts sichtbar — ein fortlaufendes Protokoll mit automatischem
  Nachladen alle 15 Sekunden, ohne zusätzliche Infrastruktur.

**Korrektur in v0.19:** In v0.18 wurden zwei technische Bitrix24-Codes
("Neu" und "Wartet auf Bearbeitung") noch unterschiedlich beschriftet
("Neu" bzw. "Ausstehend"), obwohl Bitrix24 selbst beide in seiner
Kanban-Ansicht zu einer einzigen Spalte "Neu" zusammenfasst – das führte
dazu, dass die meisten Aufgaben in der App "Ausstehend" zeigten, obwohl sie
in Bitrix24 unter "Neu" standen. Jetzt zeigt die App an dieser Stelle
ebenfalls einheitlich "Neu", passend zu Bitrix24.

**Bekannte Einschränkung:** Der Webhook dieser App darf aus technischen
Gründen nur die ältere ("deprecated") Bitrix24-Schnittstelle für Aufgaben
nutzen (siehe Kommentare in `src/lib/bitrix24.ts`) – Bitrix24 selbst
verweigert der neueren Schnittstelle den Zugriff über einen einfachen
Webhook. Bei einzelnen Aufgaben, die gerade erst in Bitrix24 selbst per
Drag & Drop in eine andere Spalte verschoben wurden, kann der über diese
ältere Schnittstelle gelieferte Status dadurch kurzzeitig noch den alten
Stand zeigen. Das betrifft nur einzelne, kürzlich verschobene Aufgaben und
behebt sich von selbst; eine komplett lückenlose Übereinstimmung mit
Bitrix24 wäre nur mit einer höheren Webhook-Berechtigung möglich, die
Bitrix24 für diese Art Webhook bisher nicht zulässt.

## Online stellen (Vercel)

Damit auch Cindy (und Sie selbst vom Handy) die App erreichen, ohne dass
Ihr Rechner laufen muss:

1. Vercel-Konto anlegen: [vercel.com](https://vercel.com) (kostenlos).
2. Im Projektordner (`npx` lädt Vercel bei Bedarf automatisch, ohne globale
   Installation — das umgeht Berechtigungsprobleme auf manchen Rechnern):
   ```bash
   npx vercel login
   npx vercel link
   ```
3. Im Vercel-Dashboard → Ihr Projekt → **Storage** → Datenbank verbinden →
   **Postgres** (läuft über Neon, kostenloser Tarif) → mit dem Projekt
   verbinden. Auf **Connect to this project** achten und im
   Umgebungen-Dropdown sicherstellen, dass **alle drei** Umgebungen
   (Production, Preview, Development) verbunden sind.
4. Im Vercel-Dashboard → Ihr Projekt → **Settings** → **Environment
   Variables** → `SESSION_SECRET` eintragen (langer Zufallstext, z. B. mit
   `openssl rand -hex 32` erzeugt) für alle Umgebungen. Für die
   Aufgaben-Anbindung zusätzlich `BITRIX24_WEBHOOK_URL` eintragen (siehe
   Abschnitt „Bitrix24-Aufgaben" oben) — ohne diese Variable läuft die App
   normal, nur der Aufgaben-Bereich zeigt dann eine Fehlermeldung an.
5. Lokal die echten Werte holen und Datenbank einrichten:
   ```bash
   npx vercel env pull .env.local
   npm run db:init
   ```
6. Live schalten:
   ```bash
   npx vercel --prod
   ```
   Vercel zeigt danach eine URL wie `https://project-builder-xyz.vercel.app`.
   Beim ersten Öffnen legt sich jede Person unter `/register` ihr eigenes
   Konto an (siehe Abschnitt „Registrierung & Zugänge" oben).

### Update auf v0.3 (bereits live geschaltete App)

War die App schon vorher live (Basic Auth mit `APP_USER`/`APP_PASSWORD`),
reicht ein kurzes Update statt einer Neueinrichtung:

1. Neue Dateien einspielen, dann lokal:
   ```bash
   npm install
   ```
2. Im Vercel-Dashboard → **Settings** → **Environment Variables**:
   `SESSION_SECRET` neu anlegen (alle Umgebungen); `APP_USER`/`APP_PASSWORD`
   können danach gelöscht werden, werden aber nicht mehr ausgewertet.
3. Aktuelle Werte holen und die neue `users`-Tabelle anlegen (bestehende
   Projekte bleiben unangetastet, nur `mitglieder` wird ergänzt):
   ```bash
   npx vercel env pull .env.local
   npm run db:init
   ```
4. Live schalten:
   ```bash
   npx vercel --prod
   ```
   Ab jetzt fragt die App beim ersten Öffnen nicht mehr nach
   `APP_USER`/`APP_PASSWORD`, sondern verlangt eine Anmeldung unter
   `/login`. Für Be Happy Again einfach unter `/register` mit
   `balthasar@balthasar-fleischmann.de` bzw. `hallo@cindyendres.de` ein Konto
   anlegen — der Zugriff auf das Projekt ist dafür schon vorbereitet.

### Update auf v0.4 (Bitrix24-Aufgaben nachrüsten)

Kein Datenbank-Update nötig — nur eine neue Umgebungsvariable:

1. Neue Dateien einspielen, dann lokal `npm install`.
2. Webhook-Scopes in Bitrix24 ergänzen und `BITRIX24_WEBHOOK_URL` in Vercel
   eintragen (siehe Abschnitt „Bitrix24-Aufgaben" oben).
3. `npx vercel --prod`.

## Bewusste Einschränkungen dieser Version

- **E-Mail-Versand nur für Team-Einladungen.** Registrierung/Passwort-Vergabe
  läuft weiterhin ohne Bestätigungs-Mail oder „Passwort vergessen" — passend
  für einen kleinen, bekannten Personenkreis; vor größerer Öffnung
  nachrüsten.
- **Sprachnotizen ohne Bitrix24-Sync.** Notizen zu Aufgaben leben nur in der
  App-eigenen Datenbank, nicht als Kommentar in Bitrix24 selbst.
- **Rollen erst zweistufig (Mitglied/Kernteam, plus Admin).** Kernteam-
  Mitglieder dürfen zusätzlich die Phase wechseln (siehe oben); feinere
  Rollen (Besucher/Interessent/Mitwirkender/Projektleiter, offene
  Entscheidung Nr. 7 im Plan) mit jeweils eigenen, engeren Rechten sind
  noch nicht abgebildet — jedes Mitglied sieht und bearbeitet Aufgaben,
  Projekt-Check und Team aktuell gleichermaßen.
- **Phasenwechsel nur "eine Stufe vor", kein Zurück oder Sprung.** Der
  Knopf „Weiter zu: …" geht immer nur zur nächsten Stufe im normalen
  Verlauf; eine Phase zurücksetzen oder gezielt eine bestimmte Phase
  auswählen geht weiterhin nur per Skript (`scripts/set-phase.mjs`).
- **Bitrix24-Aufgaben ohne Deal-Stage-Sync.** Aufgaben (lesen/schreiben/
  erledigen) und Arbeitsgruppen sind angebunden; ein automatischer Abgleich
  „App-Phase ↔ Bitrix24-Pipeline-Stage" gibt es noch nicht — die
  Phase wird weiterhin nur in der App gepflegt.
- **Ein Webhook-Fehler zeigt nur Text, kein Retry-Mechanismus.** Schlägt ein
  Bitrix24-Aufruf fehl (z. B. fehlender Scope), erscheint eine
  Fehlermeldung im Cockpit; ein automatisches Wiederholen gibt es nicht.

## Nächste Ausbaustufen (Kapitel 28)

In sinnvoller Reihenfolge:

1. Deal-Stage-Sync (App-Phase ↔ Bitrix24-Pipeline-Stage automatisch abgleichen)
2. Feinere Rollen (Besucher/Interessent/Mitwirkender/Kernteam/
   Projektleiter/Admin) statt nur Mitglied/Admin
3. „Was ist jetzt zu tun?"-Funktion
4. Business Case / Grundfinanzen
5. Sprachnotizen auch auf Projekt-Ebene (nicht nur je Aufgabe), inkl.
   automatischer Transkription
6. KI-Recherche und Failure Check
