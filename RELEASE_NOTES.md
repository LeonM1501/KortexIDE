# Kortex IDE v1.0.0

Initiales Release von Kortex IDE – einer Desktop-Entwicklungsumgebung mit integrierter KI-Agenten-Steuerung für lokale Workspaces.

---

## Funktionen und Änderungen

### 1. KI-Agent und Workspace-Integration
* Direkte Anbindung an ChatGPT im Hintergrund zur automatisierten Bearbeitung von Aufgaben.
* Dateisystem-Tools:
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
