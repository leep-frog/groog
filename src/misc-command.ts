import { basename } from 'path';
import path = require('path');
import * as vscode from 'vscode';
import { Emacs } from './emacs';

interface MiscCommand {
  name: string;
  f: (emacs: Emacs, ...args: any[]) => Thenable<any>;
  noLock?: boolean;
}

export const miscCommands: MiscCommand[] = [
  {
    name: "multiCommand.execute",
    f: (e: Emacs, mc: MultiCommand) => multiCommand(mc),
    noLock: true,
  },
  {
    name: "message.info",
    f: (e: Emacs, msg: Message | undefined) => infoMessage(msg),
  },
  {
    name: "copyFilename",
    f: () => copyFileName(),
  },
  {
    name: "testFile",
    f: (e: Emacs, mc: TestFileArgs) => testFile(mc, e.lastVisitedFile),
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

// https://en.wikipedia.org/wiki/List_of_Unicode_characters
const HOME_UNICODE_CHAR = "\u0001";
const TERMINAL_KILL_CHAR = "\u000B";

function sendTerminalCommand(args: TestFileArgs, command: string) {
  const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();

  const text = args.part === 0 ? [
    // Exit git diff view (or any file terminal view)
    "q",
    // Move cursor to the beginning
    HOME_UNICODE_CHAR,
    // Remove any characters after the command we just added
    TERMINAL_KILL_CHAR,
  ] : [command];
  terminal.sendText(text.join(""), args.part !== 0);

  if (args.part === 1) {
    terminal.show();
  }
}

interface TestFileArgs {
  part: number;
}

async function testFile(args: TestFileArgs, file?: vscode.Uri) {
  if (!file) {
    vscode.window.showErrorMessage(`Previous file not set`);
    return;
  }

  const suffix = file.fsPath.split(".").pop();
  switch (suffix) {
  case "go":
    vscode.window.showErrorMessage(`go testing should be routed to custom command in keybindings.go`);
    break;
  case "ts":
    // It's possible to run launch.json configurations with `vscode.debug.startDebugging(fs, "Extension Tests");`
    // But `npm run test` currently does everything we need, but an option to keep in mind if ever needed.
    sendTerminalCommand(args, `npm run test`);
    break;
  case "java":
    sendTerminalCommand(args, `zts ${path.parse(file.fsPath).name}`);
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
