import * as vscode from 'vscode';

export interface MultiCommand {
  sequence: string[]
}

export async function multiCommand(mc: MultiCommand) {
  for (var command of mc.sequence) {
    await vscode.commands.executeCommand(command);
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
