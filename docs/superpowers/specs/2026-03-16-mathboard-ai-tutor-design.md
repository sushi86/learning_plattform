# MathBoard AI-Tutor — Design Spec

## Überblick

Erweiterung des MathBoard-Whiteboards um KI-gestützte Mathe-Hilfe. Die KI verhält sich wie ein Teilnehmer auf dem Canvas — sie schreibt Lösungen in Handschrift (Caveat-Font) direkt auf die Seite, markiert Fehler mit farblicher Hervorhebung und benennt relevante mathematische Regeln. Schüler interagieren über Selektion auf dem Whiteboard, nicht über ein separates Chat-UI.

## Modi

### KI Lösung
- Schüler markiert die **Aufgabenstellung** (Lasso oder Rechteck-Selektion)
- KI erstellt eine vollständige Schritt-für-Schritt-Lösung
- Lösung erscheint direkt unter der markierten Aufgabe auf dem Canvas
- Schüler kann auf einzelne Schritte klicken und Nachfragen stellen

### KI Hilfe (Korrektur)
- Schüler markiert **Aufgabenstellung + eigenen Lösungsweg**
- KI prüft jeden Schritt des Lösungswegs
- Fehler werden rot markiert mit Erklärung, korrekte Schritte grün bestätigt
- Bei Regelverstößen wird die mathematische Regel benannt und kurz erklärt

## Architektur

```
┌─────────────┐     Screenshot (PNG base64)  ┌──────────────┐
│  Whiteboard  │ ───────────────────────────► │  Next.js API  │
│  (Konva)     │                              │  /api/ai/*    │
│              │  ◄─────────────────────────  │               │
│  rendert     │     JSON (Steps/Korrektur)   │  AI Provider  │
│  KI-Shapes   │                              │  Adapter       │
└─────────────┘                               └──────┬───────┘
                                                      │
                                              ┌───────▼───────┐
                                              │  Provider      │
                                              │  Interface     │
                                              ├───────────────┤
                                              │ Claude Adapter │
                                              │ OpenAI Adapter │
                                              └───────────────┘
```

### Kern-Komponenten

1. **Selection-Tools** (Client) — Lasso + Rechteck-Selektion, rendert Bereich als PNG via `stage.toDataURL()`
2. **AI-Toolbar** (Client) — "KI Lösung" / "KI Hilfe" Buttons nach Selektion
3. **API-Routes** (Server) — `/api/ai/solve`, `/api/ai/check`, `/api/ai/explain`
4. **Provider-Interface** (Server) — Abstraktes Interface mit Adaptern für Claude/OpenAI
5. **Canvas-Renderer** (Client) — Rendert KI-Response als Konva-Shapes in Caveat-Font

## Selection & Screenshot-Capture

### Neue Tools

Das bestehende Select-Tool wird erweitert:
- **Rechteck-Selektion** — Bereich aufziehen (wie ein Screenshot-Tool)
- **Lasso-Selektion** — Freihand-Bereich zeichnen

### Flow

1. Schüler wählt Selektions-Tool und zieht Bereich auf
2. Bounding-Box wird berechnet
3. Konva rendert den Bereich als PNG: `stage.toDataURL({ x, y, width, height })`
4. Zwei Buttons erscheinen an der Selection: **"KI Lösung"** und **"KI Hilfe"**
5. Klick sendet PNG + Modus an die API
6. Selection (gestrichelte lila Linie) verschwindet nach der KI-Antwort

### Selection State

Die Selection ist **rein ephemeral/lokal** — sie wird nicht in Y.js gespeichert und nicht synchronisiert. Sie existiert nur als React-State auf dem Client des Schülers.

```typescript
type AiSelection = {
  points: number[];     // Lasso: Freihand-Punkte, Rect: 4 Eckpunkte
  bounds: { x: number; y: number; width: number; height: number };
  screenshotDataUrl: string;  // PNG des Bereichs, direkt nach Selektion erstellt
};
```

Nach dem Klick auf "KI Lösung" / "KI Hilfe" wird der Screenshot an die API gesendet und die Selection aufgelöst.

### Screenshot-Capture

Beim Rendern des Screenshots muss die Stage-Transformation (Zoom/Pan) zurückgesetzt werden, um nur den tatsächlichen Canvas-Bereich in Page-Koordinaten zu erfassen. Analog zum bestehenden PDF-Export und Thumbnail-Rendering (siehe Commits `704061b`, `04d0548`).

## AI Provider Interface

### Interface

```typescript
interface AiProvider {
  solve(image: Buffer, systemPrompt: string): Promise<AiSolveResponse>;
  check(image: Buffer, systemPrompt: string): Promise<AiCheckResponse>;
  explain(image: Buffer, context: AiExplainContext, systemPrompt: string): Promise<AiExplainResponse>;
}

type AiExplainContext = {
  previousSteps: { text: string; explanation: string }[];  // bisherige KI-Lösung
  step: string;       // der angeklickte Schritt
  question: string;   // die Frage des Schülers
};
```

### Response-Typen

```typescript
type AiSolveResponse = {
  steps: { text: string; explanation: string }[];
  proof?: string;
};

type AiCheckResponse = {
  correct: boolean;
  steps: {
    studentStep: string;
    isCorrect: boolean;
    correction?: string;
    rule?: string;
  }[];
  hint: string;
};

type AiExplainResponse = {
  explanation: string;
  rule?: string;
  additionalSteps?: { text: string; explanation: string }[];
};
```

### Provider-Konfiguration

```
AI_PROVIDER=claude | openai
AI_API_KEY=sk-...
```

Factory-Pattern:

```typescript
function getAiProvider(): AiProvider {
  switch (process.env.AI_PROVIDER) {
    case "claude": return new ClaudeAdapter(process.env.AI_API_KEY);
    case "openai": return new OpenAiAdapter(process.env.AI_API_KEY);
    default: throw new Error("AI_PROVIDER not configured");
  }
}
```

## API-Routes

| Route | Method | Body | Beschreibung |
|-------|--------|------|-------------|
| `/api/ai/solve` | POST | `{ image: base64, pageId }` | KI-Lösung anfordern |
| `/api/ai/check` | POST | `{ image: base64, pageId }` | KI-Korrektur anfordern |
| `/api/ai/explain` | POST | `{ image: base64, previousSteps: [...], step, question, pageId }` | Nachfrage zu einem Schritt |

Alle Routes prüfen:
1. Session (authentifiziert)
2. `user.aiEnabled === true` (freigeschaltet)
3. Workspace-Membership (pageId → workspace → member)

## Canvas-Rendering der KI-Antworten

### Type-System-Integration

Die bestehende `Shape` Union in `src/components/whiteboard/types.ts` muss erweitert werden:

```typescript
// Bestehend:
export type Shape = DrawShape | LineShape | TextShape | ImageShape;
// Erweitert zu:
export type Shape = DrawShape | LineShape | TextShape | ImageShape | AiStepShape | AiCorrectionShape;
```

Ebenso muss der Canvas-Render-Switch in `WhiteboardCanvas.tsx` um Cases für `"ai-step"` und `"ai-correction"` erweitert werden. Das `source: "ai"` Feld dient dazu, KI-generierte Shapes von Schüler-Shapes zu unterscheiden — z.B. um sie visuell abzusetzen (KI-Badge), beim Löschen als Gruppe zu behandeln, oder Bearbeitung durch Schüler zu verhindern.

### Shape-Typen

```typescript
type AiStepShape = {
  id: string;
  type: "ai-step";
  x: number; y: number;
  text: string;
  explanation: string;
  stepIndex: number;
  groupId: string;        // verbindet alle Schritte einer Antwort
  color: string;
  source: "ai";
};

type AiCorrectionShape = {
  id: string;
  type: "ai-correction";
  x: number; y: number;
  text: string;
  isCorrect: boolean;
  correction?: string;
  rule?: string;
  groupId: string;
  color: string;
  source: "ai";
};
```

### Farben

| Element | Farbe | Hex |
|---------|-------|-----|
| KI-Lösung (Schritte) | Lila | `#7c6ef5` |
| Korrektur: korrekt | Grün | `#2a9d4e` |
| Korrektur: Fehler | Rot | `#e04040` |
| KI-Badge | Lila Pill | `#7c6ef5` |

### Positionierung

- KI-Shapes werden **unter** der Selection-Boundary platziert (y + bounds.height + 20px)
- Jeder Schritt bekommt eine neue Zeile (y-Offset basierend auf Caveat-Zeilenhöhe)
- Alle Schritte teilen eine `groupId` → zusammen verschiebbar/löschbar
- Kleines "KI"-Badge (lila Pill) vor dem ersten Schritt

### Rendering

- Konva `<Text>` Nodes: `fontFamily: "Caveat"`, `fontSize: 24`
- Regeln werden als kleinerer Text unter der Korrektur angezeigt (`fontSize: 18`, leicht eingerückt)
- `hint`-Feld aus `AiCheckResponse` wird als abschließender Text unter allen Korrektur-Shapes angezeigt (lila, kursiv, `fontSize: 20`)
- Caveat-Font muss vor dem Rendering geladen sein (wird bereits via `next/font/google` in `layout.tsx` eingebunden — Konva nutzt die geladene Browser-Font)
- Falls die KI-Shapes über den unteren Rand der A4-Seite hinausgehen, werden sie trotzdem platziert — der Canvas ist scrollbar. Kein automatischer Seitenumbruch.

### Interaktion — Nachfrage

1. Schüler klickt auf einen `ai-step` Shape
2. Eingabefeld erscheint (wie bestehendes Text-Tool)
3. Schüler tippt Frage → Enter
4. Original-Screenshot + KI-Lösung + Frage gehen an `/api/ai/explain`
5. Antwort wird als zusätzliche Shapes unter dem angeklickten Schritt eingefügt (eingerückt, kleiner)

### Y.js-Integration

KI-Shapes werden als normale Shapes in die Y.js Shapes-Map eingefügt:
- Synchronisieren automatisch über WebSocket
- Lehrer sieht KI-Antworten in Echtzeit
- Undo/Redo funktioniert wie bei allen anderen Shapes

## Zugriffskontrolle

### DB-Erweiterung

```prisma
model User {
  // ... bestehende Felder
  aiEnabled  Boolean @default(false)
}
```

- Neue User: `aiEnabled = false` (Standard)
- Freischaltung ausschließlich durch den Plattform-Betreiber (manuell in DB)
- Kein UI für Freischaltung — bewusst manuell zur Kostenkontrolle
- Lehrer und Schüler können sich nicht selbst freischalten

### Prüfung

**Server:** Alle `/api/ai/*` Routes prüfen `user.aiEnabled`:

```typescript
if (!user.aiEnabled) {
  return Response.json(
    { error: "KI-Funktionen sind noch nicht freigeschaltet. Kontaktiere den Betreiber." },
    { status: 403 }
  );
}
```

**Client:** `aiEnabled` wird in der JWT-Session mitgeliefert. Wenn `false`, erscheinen die KI-Buttons nach Selektion nicht.

**Type-Deklarationen:** Die `Session`, `User` und `JWT` Types in `src/lib/auth.types.ts` müssen um `aiEnabled: boolean` erweitert werden. Die `jwt`- und `session`-Callbacks in `auth.ts` müssen das Feld propagieren.

## Systemprompts

Gespeichert als Konstanten in `src/lib/ai/prompts.ts`.

### Lösungs-Prompt

```
Du bist ein geduldiger Mathe-Tutor für Schüler. Du erhältst ein Bild
einer Matheaufgabe.

Löse die Aufgabe Schritt für Schritt. Jeder Schritt muss für einen
Schüler nachvollziehbar sein. Schreibe Rechenoperationen mit Strich
dahinter (z.B. "| -4", "| :2", "| ·3").

Beende mit einer Probe wenn möglich.

Antworte ausschließlich im folgenden JSON-Format:
{
  "steps": [
    { "text": "2x + 4 = 10  | -4", "explanation": "4 auf beiden Seiten subtrahieren" }
  ],
  "proof": "2·3 + 4 = 10 ✓"
}
```

### Korrektur-Prompt

```
Du bist ein ermutigender Mathe-Tutor. Du erhältst ein Bild mit einer
Matheaufgabe und dem Lösungsversuch eines Schülers.

Prüfe jeden Schritt des Lösungswegs. Finde den ersten Fehler und
erkläre kindgerecht, warum er falsch ist. Lobe was richtig ist.

Wenn der Schüler eine mathematische Regel oder ein Gesetz missachtet
hat (z.B. Punkt-vor-Strich, Kommutativgesetz, binomische Formeln),
nenne die Regel beim Namen und erkläre sie kurz in einem Satz.

Antworte ausschließlich im folgenden JSON-Format:
{
  "correct": false,
  "steps": [
    { "studentStep": "3x = 21", "isCorrect": true, "correction": null },
    { "studentStep": "x = 10.5", "isCorrect": false, "correction": "Hier muss durch 3 geteilt werden: x = 7", "rule": "Division: Um x zu isolieren, teilst du durch den Koeffizienten vor x (hier 3)." }
  ],
  "hint": "Schau dir nochmal an, durch welche Zahl du teilen musst!"
}
```

### Nachfrage-Prompt

```
Du bist ein geduldiger Mathe-Tutor. Ein Schüler hat eine Frage zu
einem bestimmten Rechenschritt.

Der bisherige Lösungsweg:
{steps}

Die Frage des Schülers zum Schritt "{step}":
"{question}"

Erkläre diesen Schritt kindgerecht. Wenn der Schritt auf einer
mathematischen Regel oder einem Gesetz basiert (z.B. Distributiv-
gesetz, Satz des Pythagoras), nenne die Regel beim Namen und erkläre
sie kurz. Nutze Analogien wenn hilfreich. Halte dich kurz.

Antworte ausschließlich im folgenden JSON-Format:
{
  "explanation": "Wenn du 2x hast und wissen willst was x ist...",
  "rule": "Äquivalenzumformung: Was du auf einer Seite machst, musst du auch auf der anderen Seite machen.",
  "additionalSteps": null
}
```

## Ladezustand & Fehlerbehandlung

### Loading State

KI-Anfragen dauern typisch 5–15 Sekunden. Während die Antwort lädt:
- Die Selection bleibt sichtbar (gestrichelte lila Linie)
- Ein pulsierendes "KI denkt nach..."-Label erscheint an der Selection
- Die KI-Buttons werden deaktiviert

### Fehler

| Fehler | Client-Verhalten |
|--------|-----------------|
| AI-Provider-Fehler (500, Timeout) | Toast: "KI ist gerade nicht erreichbar. Versuch es später nochmal." Selection bleibt bestehen für Retry. |
| Rate Limit (429) | Toast: "Zu viele Anfragen. Warte kurz." |
| Ungültiger API-Key | Toast: "KI-Konfiguration fehlerhaft." (nur für Betreiber relevant) |
| Malformed JSON von KI | Server validiert die Response gegen die erwarteten Typen. Bei ungültigem Format: 502 an Client, Toast: "KI-Antwort konnte nicht verarbeitet werden." |

### Rate Limiting

Einfaches serverseitiges Rate Limit: **20 Anfragen pro Stunde pro User.** Wird als In-Memory-Counter im API-Handler umgesetzt (kein Redis nötig bei Single-Process-Architektur). Reicht für den aktuellen Nutzungsumfang. Bei Überschreitung: 429 Response.

## Context-Management

**Stateless pro Anfrage.** Kein persistenter Chat-Thread.

- **KI Lösung:** Screenshot → API → Response
- **KI Hilfe:** Screenshot (Aufgabe + Lösung) → API → Response
- **Nachfrage:** Original-Screenshot + bisherige KI-Lösung (als JSON) + Frage → API → Response

Der volle Kontext steckt im einzelnen Request. Kein State in DB oder Server-Memory nötig.

## Bestehende Systeme — keine Breaking Changes

| System | Änderung |
|--------|----------|
| Whiteboard/Canvas | Neue Shape-Typen, bestehende Tools unberührt |
| Y.js Sync | KI-Shapes als normale Shapes, kein Sync-Änderung |
| Auth | `aiEnabled` Feld in JWT-Session ergänzen |
| DB | Ein neues Feld `aiEnabled` in User-Tabelle |
| API | Neue `/api/ai/*` Routes, bestehende unberührt |
| Permissions | `aiEnabled`-Check in neuen Routes |
| Rollen | TEACHER/STUDENT bleiben unverändert |
