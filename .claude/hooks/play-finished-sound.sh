#!/usr/bin/env bash
# Reproduce el MP3 de notificación de Claude Code vía el MediaPlayer de Windows
# (WSL2 no trae reproductores de audio Linux instalados; SoundPlayer de .NET
# solo soporta WAV, por eso se usa System.Windows.Media.MediaPlayer).
MP3="/home/max/udemy/claudeCode/05-arcade-vault/public/claudecode-finished.mp3"
WINPATH="$(wslpath -w "$MP3")"

nohup powershell.exe -NoProfile -Command \
  "Add-Type -AssemblyName presentationCore; \
   \$p = New-Object System.Windows.Media.MediaPlayer; \
   \$p.Open([uri]'$WINPATH'); \$p.Play(); \
   Start-Sleep -Seconds 5; \$p.Stop(); \$p.Close()" \
  >/dev/null 2>&1 &
