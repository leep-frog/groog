
import { basename } from 'path';
import * as vscode from 'vscode';
import { endDocumentPosition } from './character-functions';
import { Emacs } from './emacs';
import { getLanguageSpec } from './language-behavior';

export const FILE_ISH_SCHEMES = ["file", "vscode-remote", "vscode-local"];


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
    name: "noTest",
    f: miscEditorFunc((e: vscode.TextEditor) => noTest(e)),
  },
  {
    name: "yesTest",
    f: miscEditorFunc((e: vscode.TextEditor) => yesTest(e)),
  },
  {
    name: "toggleYesNoTest",
    f: miscEditorFunc((e: vscode.TextEditor) => toggleYesNoTest(e)),
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
        if (!currentFile || !(FILE_ISH_SCHEMES.includes(currentFile.scheme))) {
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

    // Some commands (notably "notebook.cell.execute") fail if passed an undefined
    // arguments object. In order to avoid this issue, we simply don't pass
    // sc.args if it's undefined.
    const func = sc.args === undefined ? () => vscode.commands.executeCommand(sc.command) : () => vscode.commands.executeCommand(sc.command, sc.args);

    if (sc.delay) {
      setTimeout(func, sc.delay);
    } else if (sc.async) {
      func()
    } else {
      await func();
    }
  }
}

// https://en.wikipedia.org/wiki/List_of_Unicode_characters
const HOME_UNICODE_CHAR = "\u0001";
const TERMINAL_KILL_CHAR = "\u000B";

export async function sendTerminalCommand(args: TestFileArgs, command: string) {
  const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();

  const textSetup = [
    // Exit git diff view (or any file terminal view)
    "q",
    // Move cursor to the beginning
    HOME_UNICODE_CHAR,
    // Remove any characters after the command we just added
    TERMINAL_KILL_CHAR,
  ];

  const text = [];
  switch (args.part) {
    case 0:
      text.push(...textSetup);
      break;
    case 1:
      text.push(command);
    case 2:
      text.push(...textSetup, command);
      break;
    default:
      vscode.window.showErrorMessage(`Must provide part`);
      return;
  }

  terminal.sendText(text.join(""), args.part !== 0);

  if (args.part === 1) {
    await vscode.commands.executeCommand("termin-all-or-nothing.openPanel");
  }
}

export interface TestFileArgs {
  part: number;
}

async function testFile(args: TestFileArgs, lastFile?: vscode.Uri) {
  const file = fixedTestFile ?? lastFile;
  if (!file) {
    vscode.window.showErrorMessage(`Previous file not set`);
    return;
  }

  await getLanguageSpec(file).testingBehavior(args, file);
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



async function toggleYesNoTest(editor: vscode.TextEditor): Promise<any> {
  if (editor.document.getText().includes("def no_test")) {
    return yesTest(editor);
  }
  return noTest(editor);
}

async function yesTest(editor: vscode.TextEditor): Promise<any> {
  return replaceInEditor(editor, "def no_test", "def test");
}

async function noTest(editor: vscode.TextEditor): Promise<any> {
  return replaceInEditor(editor, "def test", "def no_test");
}

async function replaceInEditor(editor: vscode.TextEditor, from: string, to: string): Promise<any> {
  return editor.edit(eb => {
    // Replace all occurrences of 'from' with 'to'
    const lines = editor.document.getText().split("\n");

    lines.forEach((line, idx) => {
      const matchAt = line.indexOf(from);
      if (matchAt < 0) {
        return;
      }

      eb.replace(new vscode.Range(
        new vscode.Position(idx, matchAt),
        new vscode.Position(idx, matchAt + from.length)
      ), to);
    });
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



async function copyImport(editor: vscode.TextEditor) {
  const copyImportFunc = getLanguageSpec(editor.document).copyImport
  if (copyImportFunc === undefined) {
    vscode.window.showErrorMessage(`No import copy support for language (${editor.document.languageId})`);
  } else {
    return copyImportFunc(editor.document);
  }
}
