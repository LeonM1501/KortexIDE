# ⚡ FreeAI - Autonomous Coding Agent für ChatGPT Web

> **Verwandelt das kostenlose ChatGPT Web-Modell in eine unbegrenzte, vollautonome Coding-IDE mit direktem Dateisystem- und Terminal-/CMD-Zugriff auf deinem PC!**

---

## 🌟 Features

- ♾️ **Unbegrenzte, 100% kostenlose Nutzung**: Nutzt direkt die Web-Version von ChatGPT (`chatgpt.com`).
- 🤖 **Vollautonomer ReAct Agent-Loop**: Du gibst ein Ziel ein (z. B. *"Baue mir eine komplette moderne Website"*), und ChatGPT führt selbstständig Schritt für Schritt alle Datei- und Terminal-Operationen aus.
- 📁 **Echter Dateizugriff**: ChatGPT kann Dateien in deinem lokalen Projektordner auflisten (`list_files`), lesen (`read_file`), neu schreiben (`write_file`), bearbeiten (`edit_file`) und löschen (`delete_file`).
- ⚡ **CMD & Terminal-Ausführung**: Führt Befehle wie `npm install`, `npm run dev`, `python app.py` oder `dir` automatisch aus und liefert die Ausgaben zurück an ChatGPT.
- 🍞 **Echtzeit Toast-Benachrichtigungen**: Stylische Status-Meldungen unten rechts im Browser (z. B. *"ChatGPT fordert Dateiliste an..."*, *"Schreibe index.html..."*, *"Befehl `npm run build` ausgeführt"*).
- 🪟 **Glassmorphic Floating HUD**: Ein modernes, minimierbares Dashboard direkt auf der ChatGPT-Oberfläche mit Ordnerauswahl, Task-Input, Start/Pause/Stop-Buttons und Live-Aktivitätsprotokoll.

---

## 📂 Projektstruktur

```
FreeAI/
├── bridge-server/         # Lokaler Server für Dateisystem & CMD
│   ├── server.js          # Nativer Node.js Server (Port 4000)
│   ├── start-bridge.bat   # 1-Klick Starter für Windows
│   ├── package.json
│   └── test.js            # Automatischer Integrationstest
├── extension/             # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── content.js         # Autonomer Agent Loop & DOM Controller
│   ├── content.css        # Modernes UI Design & Toasts
│   ├── popup/             # Extension Popup
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── icons/             # Extension Icons
└── README.md
```

---

## 🚀 Schnellstart in 3 einfachen Schritten

### Schritt 1: Lokalen Bridge-Server starten
1. Öffne den Ordner `bridge-server/`.
2. Doppelklicke auf **`start-bridge.bat`** (oder führe `node server.js` im Terminal aus).
3. Du siehst:
   ```
   ======================================================
     🚀 FreeAI Bridge Server läuft auf Port 4000
     📂 Aktiver Workspace: C:\...
     🔗 Extension Status URL: http://localhost:4000/api/status
   ======================================================
   ```
*(Lass dieses Fenster im Hintergrund geöffnet, solange du mit dem Agenten arbeitest)*

---

### Schritt 2: Chrome Extension installieren
1. Öffne Google Chrome und tippe in die Adressleiste:
   ```
   chrome://extensions
   ```
2. Aktiviere oben rechts den Schalter **"Entwicklermodus"** (Developer Mode).
3. Klicke oben links auf **"Entpackte Erweiterung laden"** (Load unpacked).
4. Wähle den Ordner **`FreeAI/extension`** aus.
5. Die Erweiterung **"FreeAI - Autonomous Coding Agent"** ist nun aktiv!

---

### Schritt 3: ChatGPT Web öffnen & Loslegen
1. Gehe im Browser auf **[https://chatgpt.com](https://chatgpt.com)**.
2. Oben rechts siehst du nun das schwebende **FreeAI Agent Dashboard**!
3. Wähle deinen gewünschten Projektordner auf deinem PC (oder klicke auf **📂 Browse**).
4. Gib deine gewünschte Aufgabe ein, zum Beispiel:
   - *"Erstelle eine moderne, responsive Portfolio-Website mit HTML, CSS und JS inklusive Dark Mode und Animationen"*
   - *"Erstelle eine Todo-App mit LocalStorage und Kategorien"*
   - *"Analysiere das aktuelle Projekt und füge Unit-Tests hinzu"*
5. Klicke auf **▶️ Agent Starten**.

---

## 🔄 Wie der autonome Loop funktioniert

1. **Initialisierung**: Das FreeAI HUD sendet dein Ziel zusammen mit den System-Instruktionen an ChatGPT.
2. **Denken & Planen**: ChatGPT analysiert die Aufgabe und entscheidet, welcher Schritt als nächstes getan werden muss.
3. **Tool-Call**: ChatGPT generiert einen Befehl (z. B. `write_file` oder `run_command`).
4. **Ausführung**: Die Chrome-Extension fängt den Tool-Call ab, leitet ihn an den lokalen Bridge-Server weiter, und der Server führt die Dateioperation oder den CMD-Befehl auf deinem PC aus.
5. **Toast**: Unten rechts erscheint sofort eine Benachrichtigung über die Aktion.
6. **Rückgabe**: Die Extension schickt das Ergebnis der Aktion automatisch als nächste Chatnachricht an ChatGPT zurück.
7. **Wiederholung**: Der Agent wiederholt diesen Zyklus autonom, bis alle Dateien angelegt sind und meldet `task_completed`.

---

## 🛠️ Unterstützte Tools für ChatGPT

| Tool | Parameter | Beschreibung |
|---|---|---|
| `list_files` | `{ path?: string }` | Listet alle Dateien und Verzeichnisse auf |
| `read_file` | `{ path: string, startLine?: number, endLine?: number }` | Liest den Dateiinhalt |
| `write_file` | `{ path: string, content: string }` | Erstellt oder überschreibt eine Datei |
| `edit_file` | `{ path: string, targetContent: string, replacementContent: string }` | Ersetzt gezielt Code-Blöcke |
| `delete_file` | `{ path: string }` | Löscht eine Datei oder einen Ordner |
| `run_command` | `{ command: string, cwd?: string }` | Führt beliebige CMD/PowerShell-Befehle aus |
| `task_completed` | `{ summary: string }` | Signalisiert den erfolgreichen Abschluss |

---

## 💡 Tipps & Tricks

- **Emergency Controls**: Du kannst den Agenten jederzeit mit **⏸️ Pause** unterbrechen oder mit **⏹️ Stop** abbrechen.
- **Minimieren**: Mit dem **➖** Button im Header minimierst du das Dashboard zu einem diskreten schwebenden Badge.
- **Live-Logs**: Klicke im HUD auf das Aktivitäts-Protokoll, um jeden einzelnen Schritt und jede Terminal-Ausgabe in Echtzeit zu verfolgen.
