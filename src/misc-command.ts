import { basename } from 'path';
import * as vscode from 'vscode';

export interface MiscCommand {
  name: string;
  f: (...args: any[]) => Thenable<any>;
  noLock?: boolean;
}

export const miscCommands: MiscCommand[] = [
  {
    name: "multiCommand.execute",
    f: (mc: MultiCommand) => multiCommand(mc),
    noLock: true,
  },
  {
    name: "message.info",
    f: (msg: Message | undefined) => infoMessage(msg),
  },
  {
    name: "copyFilename",
    f: () => copyFileName(),
  },
];

interface SingleCommand {
  command: string;
  args?: any;
  async?: boolean;
  delay?: number;
}

interface MultiCommand {
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

interface Message {
  message: string;
  error?: boolean;
}

async function infoMessage(msg: Message | undefined) {
  if (!msg) {
    vscode.window.showErrorMessage("No message set");
    return;
  }

  if (msg.error) {
    vscode.window.showErrorMessage(msg.message);
  } else {
    vscode.window.showInformationMessage(msg.message);
  }
}

async function copyFileName() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    vscode.env.clipboard.writeText(basename(editor.document.fileName));
    vscode.window.showInformationMessage(`Filename copied!`);
  } else {
    vscode.window.showErrorMessage(`No active editor`);
  }
}

export function positiveMod(k: number, mod: number) {
  const modded = k % mod;
  if (modded >= 0) {
    return modded;
  }
  return modded + mod;
}
