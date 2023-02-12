# groog Extension

## Publishing Extension

### 1. Update the Version Number

Update the `version` field in `main.go` and run `vs_package` (which updates the number in `package.json`).

### 2. Publish the Update

Run the following in PowerShell from the extension's root directory (`groog`):

```
vsce publish
```
