# Kortex IDE

Kortex IDE ist eine native Desktop-Entwicklungsumgebung für Windows mit integrierter KI-Agenten-Steuerung. Die Anwendung verbindet ChatGPT im Hintergrund mit einem lokalen Projekt- und Terminal-Dateisystem, sodass Entwicklungsaufgaben direkt und autonom auf deinem PC ausgeführt werden können.

---

## Funktionen

* **Autonome Agenten-Steuerung:** Aufgaben (z. B. Erstellen von Apps, Refactorings, Fehlersuche) werden Schritt für Schritt über Tool-Calls (`read_file`, `write_file`, `edit_file`, `run_command`, `create_plan`, `step_done`, `ask_question`) abgearbeitet.
* **Integrierter Code-Editor:**
  * Syntax-Highlighting für JavaScript, TypeScript, JSON, Python, HTML, CSS, C/C++, Rust und Shell-Skripte.
  * Korrekte Textmarkierung und synchronisierte Zeilennummerierung.
  * Integrierter Diff-Viewer zur Überprüfung von Dateiänderungen.
* **Multi-Session PowerShell-Terminal:**
  * Parallele, voneinander getrennte PowerShell-Sitzungen mit jeweils eigenem Befehlsverlauf und Ausgabepuffer.
  * Schnelles Umschalten über die Terminal-Sidebar.
  * Sitzungen per Klick oder Aktionsmenü schließen und löschen.
* **Workspace- & Projektverwaltung:**
  * Beliebige lokale Verzeichnisse als Arbeitsbereich öffnen.
  * Speichern, Anheften, Umbenennen und Verwalten von Chat- und Projektsitzungen.
  * Bild- und Screenshot-Unterstützung (Dateianhänge für UI-Mockups und Fehlerberichte).
* **Kein API-Key erforderlich:** Nutzt das reguläre ChatGPT-Konto über das integrierte Browser-Interface.

---

## Projektstruktur

```
KortexIDE/
├── freeai-app/            # Desktop-Anwendung (Electron + Node.js)
│   ├── main.js            # Electron Hauptprozess & Workspace IPC
│   ├── preload.js         # Sichere Preload-Schnittstelle
│   ├── bridge-server.js   # Integrierter Workspace- & Command-Handler
│   ├── agent/             # Agenten-Logik & DOM-Controller
│   │   └── agent-inject.js
│   ├── renderer/          # Benutzeroberfläche (IDE, Editor, Terminal, Studio)
│   │   ├── index.html
│   │   ├── index.js
│   │   └── index.css
│   ├── assets/            # App-Icons und Grafiken
│   ├── installer.nsi      # NSIS Setup-Skript für Windows
│   └── package.json
├── RELEASE_NOTES.md       # Release Notes und Changelog
├── .gitignore
└── README.md
```

---

## Installation

Fertige Binärdateien stehen unter [Releases](https://github.com/LeonM1501/KortexIDE/releases) bereit:

* **Installer (`Kortex-IDE-Setup-1.0.0.exe`):** Windows-Setup mit Desktop- und Startmenü-Verknüpfung.
* **Portable (`Kortex-IDE-v1.0.0-win32-x64-portable.zip`):** Standalone-Archiv zum direkten Entpacken und Starten ohne Installation.

---

## Lokale Entwicklung

### Voraussetzungen
* Node.js (v18 oder neuer)
* npm

### Setup & Start
```bash
# In den App-Ordner wechseln
cd freeai-app

# Abhängigkeiten installieren
npm install

# Anwendung im Entwicklungsmodus starten
npm start
```

### Build & Paketierung
```bash
# Standalone-Ordner erstellen (dist/Kortex IDE-win32-x64)
npm run package

# Windows-Installer erstellen
npm run build:installer
```

---

## Lizenz

MIT License
