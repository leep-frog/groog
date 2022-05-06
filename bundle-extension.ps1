# To make a shortcut that can be invoked with a keyboard shortcut,
# See the following link:
# https://docs.microsoft.com/en-us/powershell/scripting/windows-powershell/install/creating-a-custom-powershell-shortcut?view=powershell-7.2
Push-Location .
Set-Location C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog
vsce package -o groog.vsix
Pop-Location
code --install-extension C:\Users\gleep\OneDrive\Desktop\Coding\vs-code\groog\groog.vsix
Write-Host "Installation complete!"
Start-Sleep 2
