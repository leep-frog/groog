// TODO: Only need this for Windows shells (i.e. so maybe not at all).
//       Actually maybe not even for windows shell if configured to use emacs
//       mode in windows shells (google it)
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
