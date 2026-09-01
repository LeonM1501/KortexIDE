; --------------------------------------------------
; Kortex IDE - Professional Windows Setup Wizard (NSIS)
; --------------------------------------------------

Unicode True
RequestExecutionLevel admin

!define PRODUCT_NAME "Kortex IDE"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Kortex Intelligence"
!define PRODUCT_WEB_SITE "https://kortex.ai"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\Kortex IDE.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define MAIN_EXE "Kortex IDE.exe"

; Compression
SetCompressor /SOLID lzma

; Version Info Metadata
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=1031 "ProductName" "Kortex IDE"
VIAddVersionKey /LANG=1031 "CompanyName" "Kortex Intelligence"
VIAddVersionKey /LANG=1031 "LegalCopyright" "© 2026 Kortex Intelligence"
VIAddVersionKey /LANG=1031 "FileDescription" "Kortex IDE Setup"
VIAddVersionKey /LANG=1031 "FileVersion" "1.0.0.0"
VIAddVersionKey /LANG=1031 "ProductVersion" "1.0.0.0"

; Modern UI
!include "MUI2.nsh"
!include "Sections.nsh"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "assets\icon.ico"
!define MUI_UNICON "assets\icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP_NOSTRETCH

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${MAIN_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Kortex IDE jetzt starten"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "English"

; Default Installation Directory (Program Files)
InstallDir "$PROGRAMFILES64\Kortex IDE"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "dist\Kortex IDE Setup 1.0.0.exe"

; --------------------------------------------------
; Component Sections
; --------------------------------------------------

; 1. Core Program (Required)
Section "!Kortex IDE (Hauptprogramm)" SecCore
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Copy all packaged files
  File /r "dist\Kortex IDE-win32-x64\*.*"

  ; Create Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; App Paths Registry
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${MAIN_EXE}"

  ; Add/Remove Programs Registry
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${MAIN_EXE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

; 2. Desktop Shortcut (Enabled by default)
Section "Desktop-Verknüpfung erstellen" SecDesktop
  SetShellVarContext all
  CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${MAIN_EXE}" "" "$INSTDIR\${MAIN_EXE}" 0
SectionEnd

; 3. Start Menu Shortcut (Enabled by default)
Section "Im Startmenü anheften / Verknüpfung erstellen" SecStartMenu
  SetShellVarContext all
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${MAIN_EXE}" "" "$INSTDIR\${MAIN_EXE}" 0
  CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Deinstallieren.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
SectionEnd

; 4. Taskbar / Quick Launch Shortcut (Optional)
Section /o "An Schnellstart / Taskleiste vorbereiten" SecTaskbar
  SetShellVarContext current
  CreateShortCut "$QUICKLAUNCH\${PRODUCT_NAME}.lnk" "$INSTDIR\${MAIN_EXE}" "" "$INSTDIR\${MAIN_EXE}" 0
SectionEnd

; Descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} "Installiert alle erforderlichen Dateien von Kortex IDE auf deinem Computer."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} "Platziert ein Kortex IDE Symbol auf deinem Desktop für schnellen Zugriff."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} "Erstellt Einträge im Windows Startmenü für Kortex IDE."
  !insertmacro MUI_DESCRIPTION_TEXT ${SecTaskbar} "Erstellt eine Verknüpfung für den Schnellstart."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; --------------------------------------------------
; Uninstaller Section
; --------------------------------------------------
Section "Uninstall"
  SetShellVarContext all

  ; Remove Shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Deinstallieren.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  SetShellVarContext current
  Delete "$QUICKLAUNCH\${PRODUCT_NAME}.lnk"

  ; Remove Files & Directory
  RMDir /r "$INSTDIR"

  ; Remove Registry Keys
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"

  SetAutoClose true
SectionEnd
