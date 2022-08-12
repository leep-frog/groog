// TODO: Only need this for Windows shells (i.e. so maybe not at all).
export var commands = new Map<string, () => Thenable<any>>([
  /*["terminalCursorUp", terminalCursorUp],
  ["terminalCursorDown", terminalCursorDown],*/
]);

/*function terminalCursorUp(): void {
  vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
    "text": "hola",
  });
}

function terminalCursorDown(): void {
  vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
    "text": "goodbye",
  });
}*/
