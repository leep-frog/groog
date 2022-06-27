# groog Extension

## Publishing Extension

### 1. Update the version number

Update the `version` field in `package.json`.

### 2. Authenticate in PowerShell

Ideally, PowerShell should already be authorized with an existing access token. Verify the token is still valid by going to the [Personal Access Tokens Page](https://dev.azure.com/groogle/_usersSettings/tokens) and verifying (or extending) the expiration date of the current token.

Otherwise, a new token will have to be created. Create a new token with `All Accessible Organizations` selected in the organization field and `Full Access` selected for the scopes field. 

Copy the token value and run the following in PowerShell:
```
vsce login groogle
```

Type `Y [Enter]` to overwrite the existing PAT and copy the token value (`Right Click -> Edit -> Paste`) when prompted.

### 3. Update the Extension

Finally, run the following in PowerShell from the extension's root directory (`groog`):

```
vsce publish
```

