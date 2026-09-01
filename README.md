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

Nehmt den Code.  
Kopiert den Code.  
Verändert den Code.  
Zerlegt den Code.  
Klebt ihn wieder falsch zusammen.  
Macht ihn besser.  
Macht ihn schlimmer.  
Macht daraus eine App, einen Toaster oder die nächste Weltherrschafts-Software.  
Veröffentlicht ihn.  
Verkauft ihn.  
Verschenkt ihn.  
Packt ihn auf einen USB-Stick und werft ihn eurem Nachbarn durchs Fenster.

Nennt es Fork.  
Nennt es Remix.  
Nennt es Inspiration.  
Nennt es meinetwegen geklaut.  
**Uns komplett egal.**

Ihr müsst nicht fragen.  
Ihr müsst nicht betteln.  
Ihr müsst keine zehnseitige E-Mail schreiben.  
Ihr müsst uns nicht erwähnen.  
Ihr müsst nicht einmal so tun, als wäre das alles eure geniale Idee gewesen.

**Nehmt das Ding einfach und haut ab damit.**

Wenn ihr damit Millionen verdient: stabil.  
Wenn es euren Rechner sprengt: nicht unser Problem.  
Wenn euer Umbau aussieht wie ein brennender Einkaufswagen: ebenfalls nicht
unser Problem.

> **DER CODE IST FREI.**  
> **DER CODE HAT KEINEN BESITZERKOMPLEX.**  
> **DER CODE BRAUCHT KEINE STREICHELEINHEITEN.**  
> **DER CODE IST JETZT EUER PROBLEM.**

Viel Spaß. Oder auch nicht. Macht halt.

Rechtlich maßgeblich ist die vollständige [0BSD-Lizenz](LICENSE).

Die Lizenzen von Drittanbieter-Abhängigkeiten und fremden Assets bleiben davon
unberührt.
