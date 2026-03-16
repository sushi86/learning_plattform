# MathBoard

Digitales Whiteboard mit KI-Tutor fuer den Mathe-Unterricht. Schueler loesen Aufgaben auf einem Whiteboard, waehrend ein KI-Tutor Schritt fuer Schritt erklaert, Loesungen prueft und Hinweise gibt.

Optimiert fuer iPad-Nutzung im Klassenzimmer mit Stifteingabe und Echtzeit-Kollaboration.

## Features

**Whiteboard**
- Freihand-Zeichnen mit Drucksensitivitaet (Apple Pencil)
- Linien, Text, Bild-Upload (PNG, JPEG, PDF)
- Mehrere Hintergruende: Blanko, Kariert, Liniert, Koordinatensystem
- Zoom, Pan, Undo/Redo
- Einzel- und Mehrfachauswahl (Rechteck-Selektion)

**KI-Tutor**
- **Loesen** — Markiere eine Aufgabe und die KI loest sie Schritt fuer Schritt
- **Pruefen** — Die KI findet Fehler im Loesungsweg und erklaert sie kindgerecht
- **Erklaeren** — Klicke auf einen KI-Schritt und stelle eine Nachfrage
- Unterstuetzt Claude (Anthropic) und OpenAI als Provider

**Kollaboration**
- Echtzeit-Sync via Y.js und WebSocket
- Workspaces mit Lehrer/Schueler-Rollen
- Einladungslinks fuer einfachen Beitritt
- Mehrere Seiten pro Workspace

## Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | Next.js 16, React 19, Konva (Canvas), Tailwind CSS |
| Backend | Custom Node.js Server mit WebSocket |
| Datenbank | PostgreSQL + Prisma ORM |
| Echtzeit | Y.js + WebSocket (integriert im Server) |
| Auth | NextAuth v5 (Credentials) |
| KI | Anthropic Claude / OpenAI (Vision API) |
| Deployment | Docker, GitHub Actions, GHCR |

## Schnellstart

### Voraussetzungen

- Node.js 20+
- PostgreSQL 14+

### Setup

```bash
# Dependencies installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# DATABASE_URL, NEXTAUTH_SECRET und AI_API_KEY eintragen

# Datenbank aufsetzen
npx prisma migrate dev

# Optional: Test-Daten (Lehrer + Schueler Accounts)
npx prisma db seed

# Starten
npm run dev
```

Die App laeuft auf [http://localhost:3000](http://localhost:3000).

### Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | PostgreSQL Connection String |
| `NEXTAUTH_SECRET` | Zufaelliger String fuer Session-Verschluesselung |
| `NEXTAUTH_URL` | Basis-URL der App (z.B. `http://localhost:3000`) |
| `UPLOAD_DIR` | Pfad fuer Datei-Uploads (Standard: `./uploads`) |
| `AI_PROVIDER` | `claude` oder `openai` |
| `AI_API_KEY` | API-Key des gewaehlten KI-Providers |

## Docker Deployment

```bash
# .env Datei mit Secrets anlegen
cp .env.example .env

# Starten (zieht Image von GHCR)
docker compose up -d

# Datenbank-Migrationen ausfuehren
docker compose run --rm migrate
```

Das Docker-Image wird automatisch bei Push auf `main` gebaut und nach `ghcr.io/sushi86/learning_plattform` gepusht.

## Projektstruktur

```
server.ts                    # Custom Server (HTTP + WebSocket)
src/
  app/                       # Next.js App Router
    (auth)/                  # Login / Register
    dashboard/               # Workspace-Uebersicht
    workspace/[id]/          # Workspace mit Seiten
    api/
      ai/                    # KI-Endpoints (solve, check, explain)
      upload/                # Datei-Upload
      auth/                  # NextAuth + WS-Token
  components/whiteboard/     # Canvas, Toolbar, KI-Shapes, Hintergruende
    tools/                   # Zeichen-Tools (Draw, Select, Eraser, ...)
  lib/
    ai/                      # KI-Prompts, Adapter, Typen
    auth.ts                  # NextAuth Konfiguration
    useYjsSync.ts            # Y.js Client-Hook
  server/
    yjs-rooms.ts             # Y.js Server (Raum-Management, Persistenz)
    ws-auth.ts               # WebSocket-Authentifizierung
prisma/
  schema.prisma              # Datenbank-Schema
  migrations/                # SQL-Migrationen
```

## Lizenz

Privates Projekt.
