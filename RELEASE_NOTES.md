# Kortex IDE v1.0.0

Release von Kortex IDE – einer Desktop-Entwicklungsumgebung mit integrierter KI-Agenten-Steuerung für lokale Workspaces.

---

## Funktionen und Änderungen

### 1. KI-Agent und Workspace-Integration
* Direkte Anbindung an ChatGPT im Hintergrund zur automatisierten Bearbeitung von Aufgaben.
* Intelligentes Intent-Routing: Direkte Text-Antworten auf Begrüßungen und allgemeine Fragen ohne unnötige Dateisystem-Analysen.
* Angehefteter Aufgabenplan (Pinned Plan): Der Fortschrittsbalken und die Aufgabenliste bleiben über dem Chat-Verlauf fixiert.
* Schreibgeschützte Aufgaben-Checkliste: Schritte werden ausschließlich autonom durch die KI über step_done abgehakt.
* Strikter Einzel-Schritt-Ablauf: Genau 1 Gedanken-Satz (Lautes Denken) und 1 JSON-Tool-Befehl pro Antwort.
* Auto-Resend Watchdog: Automatische Wiederholung bei stockenden Antworten oder Verbindungsabbrüchen.
* Dateisystem-Tools:
  * `list_files`: Live-Verifikation der Projektstruktur vor Dateioperationen.
  * `read_file` und `write_file`: Lesen und Erstellen von Dateien im Projektordner.
  * `edit_file`: Gezielte Änderungen und Ersetzungen in bestehendem Code.
  * `run_command`: Ausführen von Befehlen und Skripten im Terminal.
  * `create_plan` und `step_done`: Strukturierte Aufgabenlisten mit Statusanzeige.
  * `ask_question`: Rückfragen bei unklaren Anforderungen.
* Bild-Unterstützung: Screenshots und UI-Vorlagen können direkt an den Prompt angehängt werden.
* Live-Anzeige der Denkschritte und Tool-Ausführungen im Chat-Verlauf.

---

### 2. Code-Editor
* Single-Pass-Syntax-Highlighting für JavaScript, TypeScript, JSON, Python, HTML, CSS, C, C++, Rust und Shell-Skripte.
* Korrigierte Text-Markierung ohne Artefakte oder doppelte Schriftdarstellung.
* Synchronisierte Zeilennummerierung ohne eigene Scrollbalken.
* Integrierter Diff-Viewer zur Überprüfung von Dateiänderungen.

---

### 3. PowerShell-Terminal
* Unterstützung für mehrere parallele PowerShell-Sitzungen (`1: powershell`, `2: powershell`, etc.).
* Getrennter Verlauf und separate Ausgaben je Sitzung.
* Umschalten zwischen Sitzungen über die Terminal-Sidebar.
* Schließen und Löschen von Sitzungen über die Sidebar oder das Aktionsmenü.

---

### 4. Benutzeroberfläche
* Einheitliche dunkle Scrollbars im gesamten Programm.
* Verwaltung von Projekten und Konversationen (Anheften, Umbenennen, Löschen).
* Automatische Rücksetzung des Stop-Buttons bei neuem oder gelöschtem Chat.
* Zwei Arbeitsbereiche: Kortex Studio (Fokus auf Konversation) und Kortex IDE (Editor und Dateibaum).

---

## Downloads

| Datei | Typ | Beschreibung |
| :--- | :--- | :--- |
| `Kortex-IDE-Setup-1.0.0.exe` | Installer | Windows-Setup mit Desktop- und Startmenü-Verknüpfung. |
| `Kortex-IDE-v1.0.0-win32-x64-portable.zip` | Portable | Entpacken und `Kortex IDE.exe` direkt starten. |

---

## Anforderungen
* Windows 10 / Windows 11 (64-Bit)
* ChatGPT-Account (einmaliger Login über das integrierte Browser-Fenster)
