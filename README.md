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
├── LICENSE                # 0BSD: macht damit, was ihr wollt
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

### KORTEX – DIE „MACHT DOCH EINFACH, WAS IHR WOLLT“-LIZENZ

**ACHTUNG, HIER KOMMT DIE KOMPLIZIERTE JURISTISCHE KURZFASSUNG:**

## MACHT. DAMIT. WAS. IHR. WOLLT.

Nehmt den Code.<br>
Kopiert den Code.<br>
Verändert den Code.<br>
Zerlegt den Code.<br>
Klebt ihn wieder falsch zusammen.<br>
Macht ihn besser.<br>
Macht ihn schlimmer.<br>
Macht daraus eine App, einen Toaster oder die nächste Weltherrschafts-Software.<br>
Veröffentlicht ihn.<br>
Verkauft ihn.<br>
Verschenkt ihn.<br>
Packt ihn auf einen USB-Stick und werft ihn eurem Nachbarn durchs Fenster.

Nennt es Fork.<br>
Nennt es Remix.<br>
Nennt es Inspiration.<br>
Nennt es meinetwegen geklaut.<br>
**Uns komplett egal.**

Ihr müsst nicht fragen.<br>
Ihr müsst nicht betteln.<br>
Ihr müsst keine zehnseitige E-Mail schreiben.<br>
Ihr müsst uns nicht erwähnen.<br>
Ihr müsst nicht einmal so tun, als wäre das alles eure geniale Idee gewesen.

**Nehmt das Ding einfach und haut ab damit.**

Wenn ihr damit Millionen verdient: stabil.<br>
Wenn es euren Rechner sprengt: nicht unser Problem.<br>
Wenn euer Umbau aussieht wie ein brennender Einkaufswagen: ebenfalls nicht
unser Problem.

> **DER CODE IST FREI.**<br>
> **DER CODE HAT KEINEN BESITZERKOMPLEX.**<br>
> **DER CODE BRAUCHT KEINE STREICHELEINHEITEN.**<br>
> **DER CODE IST JETZT EUER PROBLEM.**

Viel Spaß. Oder auch nicht. Macht halt.

Rechtlich maßgeblich ist die vollständige [0BSD-Lizenz](LICENSE).

Die Lizenzen von Drittanbieter-Abhängigkeiten und fremden Assets bleiben davon
unberührt.
