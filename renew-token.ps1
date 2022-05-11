Write-Output "====================================================="
Write-Output "Create an access token by going to"
Write-Output "https://dev.azure.com/groogle/_usersSettings/tokens"
Write-Output "Enter (y) to overwrite PAT and then paste"
Write-Output "the token (right click) in the next prompt"
Write-Output "====================================================="
vsce login groogle
Start-Sleep 10
