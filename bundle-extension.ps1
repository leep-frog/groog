Push-Location .
Set-Location C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog
vsce package 
Pop-Location
code --install-extension C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog\groog-0.0.1.vsix
Write-Host "Installation complete!"
Start-Sleep 2
