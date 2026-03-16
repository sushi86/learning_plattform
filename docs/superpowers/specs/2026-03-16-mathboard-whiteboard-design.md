# MathBoard — Whiteboard-Modul (Phase 1) Design-Spezifikation

## Kontext

Eine Lernplattform für Schüler (10. Klasse Real, 11. Klasse Gymnasium) mit zwei Phasen:
- **Phase 1 (dieses Dokument)**: Kollaboratives Whiteboard mit Stifteingabe, Seitenverwaltung, Realtime-Sync
- **Phase 2 (später)**: KI-Tutor — Aufgaben hochladen, schrittweise KI-Lösung, interaktive Nachfragen, Übungsaufgaben

Primäre Nutzer: Die eigenen Kinder des Entwicklers. Potenzielle spätere Monetarisierung.

Die Architektur soll Phase 2 (KI-Integration) nicht ausschließen, aber es werden keine KI-spezifischen Abstraktionen in Phase 1 eingebaut.

## Kernfunktionalität

### Rollen
- **Lehrer**: Erstellt Workspaces, weist Schüler zu, korrigiert, lädt Dateien hoch, erstellt/löscht Seiten
- **Schüler**: Zeichnet auf zugewiesenen Workspaces, fügt Seiten hinzu, sieht Korrekturen

### Workspace-Konzept
- Ein Workspace = ein Thema (z.B. "Trigonometrie", "Analysis")
- Lehrer erstellt Workspaces und weist sie Schülern zu
- Ein Schüler kann mehrere Workspaces haben
- Ein Workspace kann mehreren Schülern zugewiesen werden

### Seitenverwaltung
- Seitenbasiertes Layout (nicht unendlicher Canvas)
- Hintergrund-Typen: Leer, Kariert, Liniert, Koordinatensystem
- Lehrer und Schüler können neue Seiten hinzufügen
- Sortierbar (Drag & Drop Reihenfolge)
- PDF-Export aller Seiten eines Workspace

### Whiteboard-Werkzeuge (MVP)
- Stift (verschiedene Farben und Dicken, Druckempfindlichkeit via Apple Pencil)
- Radierer
- Text-Tool
- Formen: Linie, Pfeil, Rechteck, Kreis
- Farbwahl
- Bild/PDF-Upload (wird als Element auf dem Canvas positioniert)

### Realtime-Synchronisation
- Bidirektional: Beide Parteien sehen Änderungen live
- Offline-fähig: Wenn ein Schüler schreibt während der Lehrer offline ist, wird beim nächsten Verbinden synchronisiert
- Basiert auf CRDT (Conflict-free Replicated Data Types) via Y.js
- Gleichzeitiges Zeichnen auf derselben Seite ist unterstützt (tldraw CRDT handhabt Konflikte automatisch)

### Darstellungsstil
- Handschrift-Stil (Font: Caveat oder ähnlich) für UI-Elemente
- Zeichenstriche mit natürlichem, handgezeichnetem Charakter

## Tech-Stack

| Komponente | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Canvas-Engine | tldraw (Open-Source Whiteboard-Engine) |
| Realtime-Sync | tldraw Sync Protocol (Y.js/CRDT-basiert) + WebSocket |
| WebSocket-Server | Next.js Custom Server (integriert, ein Prozess) |
| Auth | Auth.js (NextAuth v5) — E-Mail/Passwort |
| ORM | Prisma |
| Datenbank | PostgreSQL |
| Dateispeicher | Lokaler Speicher auf eigenem Server (Upload-Verzeichnis) |
| PDF-Export | jsPDF (client-seitig, Canvas → SVG → PDF) |
| PDF-Rendering | pdf.js (client-seitig, PDF-Seiten → Canvas → Bild für Upload) |
| Hosting | Eigener Server |

## Datenmodell

### User
```
id          UUID (PK)
email       String (unique)
name        String
password    String (bcrypt hashed)
role        Enum: TEACHER | STUDENT
createdAt   DateTime
updatedAt   DateTime
```

### Workspace
```
id          UUID (PK)
name        String (z.B. "Trigonometrie")
description String? (optional)
ownerId     UUID → User (Lehrer)
createdAt   DateTime
updatedAt   DateTime
```
**Cascade bei Löschung:** Alle zugehörigen Pages, WorkspaceMembers und FileUploads (inkl. Dateien auf dem Dateisystem) werden kaskadierend gelöscht.

### WorkspaceMember
```
id          UUID (PK)
workspaceId UUID → Workspace
userId      UUID → User (Schüler)
joinedAt    DateTime
```
Unique Constraint: (workspaceId, userId)

### InviteLink
```
id          UUID (PK)
workspaceId UUID → Workspace
token       String (unique, kryptographisch zufällig)
createdBy   UUID → User (Lehrer)
expiresAt   DateTime?
usedBy      UUID? → User (wird gesetzt wenn eingelöst)
usedAt      DateTime?
createdAt   DateTime
```
Einladungslinks sind Einmal-Links (ein Schüler pro Link). Bei Einlösung wird ein WorkspaceMember-Eintrag erstellt und `usedBy`/`usedAt` gesetzt. Noch nicht registrierte Nutzer werden zuerst zur Registrierung geleitet. Der Lehrer kann mehrere Links pro Workspace generieren.

### Page
```
id              UUID (PK)
workspaceId     UUID → Workspace
title           String? (z.B. "Sinussatz")
sortOrder       Int (gap-basiert: 1000, 2000, 3000... — bei Einfügen/Reorder wird der Mittelwert verwendet, bei Kollision Renummerierung)
backgroundType  Enum: BLANK | GRID | LINED | COORDINATE
canvasState     JSONB (tldraw JSON Snapshot, für initiales Laden)
yDocState       BYTEA (Y.js Dokument-Binary, für Sync-Kontinuität)
createdAt       DateTime
updatedAt       DateTime
```
`canvasState` wird als Fallback verwendet und periodisch aus dem Y.js-Zustand generiert. `yDocState` ist die primäre Persistenz — bei jedem Disconnect oder alle 30 Sekunden wird der aktuelle Y.doc-Zustand hier gespeichert.

### FileUpload
```
id          UUID (PK)
pageId      UUID → Page
uploadedBy  UUID → User
filename    String (Original-Dateiname)
mimeType    String
storagePath String (Pfad auf dem Server)
fileSize    Int (Bytes)
createdAt   DateTime
```
Dateien werden als tldraw-Asset registriert und als Shape auf dem Canvas positioniert. FileUpload dient als Speicher-Referenz.

**Limits:** Max. 10MB pro Datei. Erlaubte Typen: PNG, JPG, WEBP, PDF.

## UI-Struktur

### Dashboard (`/dashboard`)
- Header: Logo, Nutzername, Rolle, Avatar
- Workspace-Grid: Karten mit Gradient-Header, Name, zugewiesener Schüler, Seitenanzahl
- "Neuer Workspace" Button + leere Karte
- Lehrer sieht alle eigenen Workspaces + Button für Einladungslink-Generierung
- Schüler sieht alle zugewiesenen Workspaces

### Whiteboard (`/workspace/[id]`)
- Top-Bar: Zurück-Button, Workspace-Name, Online-Status der Teilnehmer, PDF-Export, Einstellungen
- Linke Seitenleiste: Miniatur-Vorschauen aller Seiten, aktive Seite hervorgehoben, "+" Button für neue Seite
- Hauptbereich: tldraw Canvas mit gewähltem Hintergrund
- Schwebende Werkzeugleiste (unten zentriert): Stift, Radierer, Text, Formen, Farbwahl, Upload

### Neue Seite Dialog
- Titel-Eingabe (optional)
- Hintergrund-Auswahl: Leer, Kariert, Liniert, Koordinatensystem (visuell dargestellt)

### Login/Register (`/login`, `/register`)
- E-Mail + Passwort
- Register-Seite auch erreichbar über Einladungslink (`/invite/[token]`): Zeigt Workspace-Name, leitet nach Registrierung automatisch zum Workspace

### Einladungslink (`/invite/[token]`)
- Zeigt Workspace-Name und Lehrer-Name
- Bereits eingeloggte Schüler: Direkt dem Workspace beitreten
- Nicht eingeloggt: Weiterleitung zu Register mit Token-Kontext, nach Registrierung automatischer Beitritt

## Seitenbasierte Canvas-Hintergründe

Die Hintergründe werden als tldraw Custom Background Layer implementiert:
- **Leer**: Weißer Hintergrund
- **Kariert**: 5mm Raster (grau, subtil)
- **Liniert**: Horizontale Linien alle 8mm
- **Koordinatensystem**: X/Y-Achsen mit Beschriftung, Rasterlinien

Die Seitengröße orientiert sich an A4 (210 × 297mm) für konsistenten PDF-Export.

## Datei-Upload Flow

1. Nutzer klickt Upload-Button in der Werkzeugleiste
2. Datei-Auswahl (Bild: PNG/JPG/WEBP, Dokument: PDF). Max 10MB.
3. Datei wird an den Server hochgeladen (`POST /api/upload`)
4. Server validiert Dateityp und Größe, speichert Datei im Upload-Verzeichnis, erstellt FileUpload-Eintrag
5. Server gibt URL zurück
6. Client erstellt tldraw Image-Shape mit der URL, positioniert es auf dem Canvas
7. Bei PDF: pdf.js rendert jede Seite client-seitig zu einem Bild (Canvas → PNG Blob), jedes Bild wird einzeln hochgeladen und als Shape platziert. Limit: max. 20 Seiten pro PDF.
8. Bei Fehlern (Upload-Fehler, ungültiger Dateityp, zu groß): Toast-Benachrichtigung mit Fehlermeldung

## Sync-Architektur

```
Client A (Schüler)  ←→  WebSocket Server  ←→  Client B (Lehrer)
                              ↕
                     PostgreSQL (Persistence)
```

- tldraw nutzt Y.js für CRDT-basierte Synchronisation
- Der WebSocket-Server läuft als Next.js Custom Server (ein Prozess, integriert)
- Zustandsänderungen werden als Y.js Updates über WebSocket verteilt
- Y.doc-Binary wird in `Page.yDocState` persistiert: bei Client-Disconnect und periodisch alle 30 Sekunden
- `Page.canvasState` (JSON) wird als Fallback periodisch aktualisiert (alle 60 Sekunden)
- Beim Öffnen eines Workspace wird `yDocState` geladen; falls leer, wird `canvasState` als Fallback verwendet

### Verbindungsabbruch-Handling
- Client versucht automatisch neu zu verbinden (exponentielles Backoff: 1s, 2s, 4s, max 30s)
- Während Offline: Änderungen werden lokal im Y.doc gehalten
- Bei Reconnect: Y.js CRDT merged automatisch lokale und remote Änderungen

## Auth-Konfiguration

- Session-Strategie: JWT (stateless, kein Session-Store nötig)
- Session-Dauer: 30 Tage
- WebSocket-Authentifizierung: JWT-Token wird beim Handshake mitgesendet und validiert

## Berechtigungsmodell

| Aktion | Lehrer (Owner) | Schüler (Member) |
|---|---|---|
| Workspace erstellen | ✅ | ❌ |
| Workspace löschen | ✅ (mit Bestätigungsdialog) | ❌ |
| Einladungslink generieren | ✅ | ❌ |
| Schüler entfernen | ✅ | ❌ |
| Seite hinzufügen | ✅ | ✅ |
| Seite löschen | ✅ | ❌ |
| Auf Canvas zeichnen | ✅ | ✅ |
| Dateien hochladen | ✅ | ✅ |
| PDF exportieren | ✅ | ✅ |
| Workspace-Einstellungen | ✅ | ❌ |

## Nicht im MVP

- Gamification (Punkte, Streaks, Levels)
- Eltern-/Lehrer-Dashboard mit Statistiken
- Echtzeit-Handschrifterkennung
- Native iPad-App
- Benachrichtigungen (Push/E-Mail)
- Versionierung/History der Canvas-Zustände
- KI-Integration (Phase 2)
- Passwort-Reset-Flow (bei Bedarf nachträglich ergänzbar)
- Horizontale Skalierung (Single-Instance-Architektur reicht für die Familie)
