import { basename } from 'path';
import path = require('path');
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

function testFileTerminal(command: string) {
  const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();
  terminal.show();
  terminal.sendText(command);
}

export async function testFile(file?: vscode.Uri) {
  if (!file) {
    vscode.window.showErrorMessage(`Previous file not set`);
    return;
  }

  const suffix = file.fsPath.split(".").pop();
  switch (suffix) {
  case "go":
    vscode.commands.executeCommand(`go.test.package`, {
      background: true,
    });
    // Note: don't use a then chain after go.test.package because then this isn't run until tests are done running!
    vscode.commands.executeCommand("termin-all-or-nothing.openPanel");
    break;
  case "ts":
    testFileTerminal(`npm run test`);
    break;
  case "java":
    testFileTerminal(`zts ${path.parse(file.fsPath).name}`);
    break;
  default:
    vscode.window.showErrorMessage(`Unknown file suffix: ${suffix}`);
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
