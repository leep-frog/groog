import * as vscode from 'vscode';

export interface SingleCommand {
  command: string;
  args?: any;
  async?: boolean;
  delay?: number;
}

export interface MultiCommand {
  sequence: SingleCommand[];
}

export async function multiCommand(mc: MultiCommand) {
  for (const sc of mc.sequence) {
    if (sc.delay) {
      setTimeout(() => vscode.commands.executeCommand(sc.command, sc.args), sc.delay);
    } else if (sc.async) {
      vscode.commands.executeCommand(sc.command, sc.args);
    } else {
      await vscode.commands.executeCommand(sc.command, sc.args);
    }
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
