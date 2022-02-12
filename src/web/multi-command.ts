import * as vscode from 'vscode';

export interface MultiCommand {
  sequence: string[]
}

export function multiCommand(mc: MultiCommand) {
  for (var command of mc.sequence) {
    vscode.commands.executeCommand(command);
  }
}
