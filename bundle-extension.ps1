Push-Location .
Set-Location C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog
vsce package -o groog.vsix
Pop-Location
code --install-extension C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog\groog.vsix
Write-Host "Installation complete!"
Start-Sleep 2
