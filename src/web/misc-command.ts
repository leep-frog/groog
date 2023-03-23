import * as vscode from 'vscode';

export interface SingleCommand {
  command: string;
  args?: any;
}

export interface MultiCommand {
  sequence: SingleCommand[];
}

export async function multiCommand(mc: MultiCommand) {
  for (var sc of mc.sequence) {
    await vscode.commands.executeCommand(sc.command, sc.args);
  }
}

export interface Message {
  message: string
}

export async function infoMessage(msg: Message | undefined) {
  if (msg) {
    vscode.window.showInformationMessage(msg.message);
  } else {
    vscode.window.showInformationMessage("no message set");
  }
}
