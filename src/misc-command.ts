import { basename } from 'path';
import * as vscode from 'vscode';
import { endDocumentPosition } from './character-functions';
import { Emacs } from './emacs';
import { stubs } from './stubs';
import path = require('path');
import gitRepoInfo = require('git-repo-info');
const { exec } = require('child_process');

export interface MiscCommand {
  name: string;
  f: (emacs: Emacs, ...args: any[]) => Thenable<any>;
  noLock?: boolean;
}

let fixedTestFile: vscode.Uri | undefined = undefined;

export function miscTestReset() {
  fixedTestFile = undefined;
}

export function miscEditorFunc(f: (e: vscode.TextEditor) => Thenable<any>): () => Thenable<any> {
  return async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`No active editor`);
      return;
    }
    return f(editor);
  };
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
    f: miscEditorFunc(copyFileName),
  },
  {
    name: "testFile",
    f: (e: Emacs, mc: TestFileArgs) => testFile(mc, e.lastVisitedFile),
  },
  {
    name: "trimClipboard",
    f: trimClipboard,
  },
  {
    name: "copyImport",
    f: miscEditorFunc(copyImport),
  },
  {
    name: "clearRunSolo",
    f: miscEditorFunc(clearRunSolo),
  },
  {
    name: "toggleFixedTestFile",
    f: async () => {
      if (!fixedTestFile) {
        const currentFile = vscode.window.activeTextEditor?.document.uri;
        if (!currentFile || currentFile.scheme !== "file") {
          vscode.window.showErrorMessage(`No active file`);
        } else {
          fixedTestFile = currentFile;
          vscode.window.showInformationMessage(`Set fixed test file to ${basename(fixedTestFile.fsPath)}`);
        }
      } else {
        fixedTestFile = undefined;
        vscode.window.showInformationMessage(`Unset fixed test file`);
      }
    },
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

async function testFile(args: TestFileArgs, lastFile?: vscode.Uri) {
  const file = fixedTestFile ?? lastFile;
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
    const javaTestCommand = `zts ${path.parse(file.fsPath).name}`;
    sendTerminalCommand(args, javaTestCommand);
    break;
  case "py":
    sendTerminalCommand(args, `prt ${path.parse(file.fsPath)}`);
    break;
  default:
    if (!args || args.part === 0) {
      vscode.window.showErrorMessage(`Unknown file suffix: ${suffix}`);
    }
    break;
  }
}

interface Message {
  message: string;
  error?: boolean;
}

async function infoMessage(msg: Message | undefined) {
  if (!msg || !msg.message) {
    vscode.window.showErrorMessage("No message set");
    return;
  }

  if (msg.error) {
    vscode.window.showErrorMessage(msg.message);
  } else {
    vscode.window.showInformationMessage(msg.message);
  }
}

export function getLineNumbers(editor: vscode.TextEditor) {
  return editor.selections.map((sel: vscode.Selection) => {
    const startLine = sel.start.line + 1;
    const endLine = sel.end.line + 1;

    if (startLine === endLine) {
      return `L${startLine}`;
    }
    return `L${startLine}-L${endLine}`;
  }).join(",");
}



async function copyFileName(editor: vscode.TextEditor) {
  stubs.execFunc(`cd ${path.dirname(editor.document.uri.fsPath)} && git ls-remote --get-url`, (err: any, stdout: string, stderr: string) => {
    if (err || stderr) {
      vscode.window.showErrorMessage(`Failed to get git repository info: ${err}; stderr:\n${stderr}`);
      return;
    }
    let remoteURL = stdout.trim().replace(/^git@/, "").replace(/\.git$/, "").replace(":", "/");
    if (!remoteURL.startsWith("http")) {
      remoteURL = `https://www.${remoteURL}`;
    }

    // Get the relative path
    const repoInfo = gitRepoInfo(editor.document.uri.fsPath);
    const relativePath = path.relative(repoInfo.root, editor.document.uri.fsPath).replace(/\\/g, '/');

    // Copy link
    vscode.env.clipboard.writeText(`${remoteURL}/blob/${repoInfo.branch}/${relativePath}#${getLineNumbers(editor)}`);
    vscode.window.showInformationMessage(`File link copied!`);
  });

}

export function positiveMod(k: number, mod: number) {
  const modded = k % mod;
  if (modded >= 0) {
    return modded;
  }
  return modded + mod;
}

async function trimClipboard() {
  const clipboard = await vscode.env.clipboard.readText();
  return vscode.env.clipboard.writeText(clipboard.trim());
}

const RUN_SOLO_REGEX = /^\s*runSolo\s*:\s*true\s*,?\s*$/;

async function clearRunSolo(editor: vscode.TextEditor) {
  const lines = editor.document.getText().split('\n');
  const filteredLines = lines.filter(value => !RUN_SOLO_REGEX.test(value));

  const range = new vscode.Range(new vscode.Position(0, 0), endDocumentPosition(editor));

  return editor.edit(eb => {
    eb.replace(range, filteredLines.join('\n'));
  });
}

const PACKAGE_REGEX = /^package\s+([^\s;]+)\s*;/;

async function copyImport(editor: vscode.TextEditor) {
  switch (editor.document.languageId) {
  case 'java':
    const lines = editor.document.getText().split('\n');
    for (const line of lines) {
      const match = PACKAGE_REGEX.exec(line);
      if (match) {
        const classname = path.parse(editor.document.fileName).name;
        return vscode.env.clipboard.writeText(`import ${match[1]}.${classname};`);
      }
    }
    vscode.window.showErrorMessage(`No import statement found!`);
    break;
  default:
    vscode.window.showErrorMessage(`No import copy support for language (${editor.document.languageId})`);
  }
}
