$wsh = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$startMenuPath = [Environment]::GetFolderPath('Programs')

# Remove legacy shortcuts
if (Test-Path "$desktopPath\Antigravity IDE.lnk") { Remove-Item -Force "$desktopPath\Antigravity IDE.lnk" }
if (Test-Path "$startMenuPath\Antigravity IDE.lnk") { Remove-Item -Force "$startMenuPath\Antigravity IDE.lnk" }

$exePath = 'C:\Users\meier\Documents\FreeAI\freeai-app\dist\Kortex IDE-win32-x64\Kortex IDE.exe'
$iconPath = 'C:\Users\meier\Documents\FreeAI\freeai-app\assets\icon.ico'

# Desktop Shortcut
$desktopLnk = $wsh.CreateShortcut("$desktopPath\Kortex IDE.lnk")
$desktopLnk.TargetPath = $exePath
$desktopLnk.WorkingDirectory = 'C:\Users\meier\Documents\FreeAI\freeai-app\dist\Kortex IDE-win32-x64'
$desktopLnk.IconLocation = "$iconPath,0"
$desktopLnk.Description = 'Kortex - Autonomous Next-Gen AI Coding Studio'
$desktopLnk.Save()

# Start Menu Shortcut
$startLnk = $wsh.CreateShortcut("$startMenuPath\Kortex IDE.lnk")
$startLnk.TargetPath = $exePath
$startLnk.WorkingDirectory = 'C:\Users\meier\Documents\FreeAI\freeai-app\dist\Kortex IDE-win32-x64'
$startLnk.IconLocation = "$iconPath,0"
$startLnk.Description = 'Kortex - Autonomous Next-Gen AI Coding Studio'
$startLnk.Save()

Write-Output "Kortex IDE shortcuts created on Desktop and Start Menu!"
