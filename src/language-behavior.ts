import * as vscode from 'vscode';
import { TestFileArgs } from "./misc-command";
import { stubs } from './stubs';
import path = require('path');


export interface LanguageSpec {
  suffix: string;
  languageId: string;
  testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<any>;
  copyImport?: (document: vscode.TextDocument) => Promise<any>;
  indentInferred?: (firstLine: string, secondLine: string) => boolean;
}

class GoSpec implements LanguageSpec {
  suffix: string = "go";
  languageId: string = "golang";

  async testingBehavior(): Promise<void> {
    vscode.window.showErrorMessage(`go testing should be routed to custom command in keybindings.go`);
  }
}

function getRelativeWorkspacePath(fileUri: vscode.Uri): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  if (!workspaceFolder) {
    return undefined; // Not inside a workspace
  }
  return path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
}

class PythonSpec implements LanguageSpec {
  suffix: string = "py";
  languageId: string = "python";

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    return stubs.sendTerminalCommandFunc(args, `prt ${file.fsPath}`);
  }

  async copyImport(document: vscode.TextDocument): Promise<any> {
    const relativePath = getRelativeWorkspacePath(document.uri);
    if (!relativePath) {
      vscode.window.showErrorMessage(`File is not in a VS Code workspace`);
      // (if ever needed) use git relative path instead
      return;
    }

    const importParts = relativePath.split("/");
    const from = importParts.length > 1 ? `from ${importParts.slice(undefined, -1).join(".")} ` : ``;
    const importStatement = `${from}import ${path.parse(importParts.at(-1)!).name}`;
    return vscode.env.clipboard.writeText(importStatement);
  }

  indentInferred(firstLine: string, secondLine: string): boolean {
    return firstLine.trim().endsWith(":");
  }
}

const PACKAGE_REGEX = /^package\s+([^\s;]+)\s*;/;

function javaIndentInferred(firstLine: string, secondLine: string): boolean {
  // If second line is a nested function, then assume an indent
  return secondLine.trim().startsWith(".");
}

class JavaSpec implements LanguageSpec {

  suffix: string = "java";
  languageId: string = "java";

  indentInferred = javaIndentInferred;

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    const javaTestCommand = `zts ${path.parse(file.fsPath).name}`;
    return stubs.sendTerminalCommandFunc(args, javaTestCommand);
  }

  async copyImport(document: vscode.TextDocument): Promise<any> {
    const lines = document.getText().split('\n');
    for (const line of lines) {
      const match = PACKAGE_REGEX.exec(line);
      if (match) {
        const classname = path.parse(document.fileName).name;
        return vscode.env.clipboard.writeText(`import ${match[1]}.${classname};`);
      }
    }
    vscode.window.showErrorMessage(`No import statement found!`);
  }


}

class TypescriptSpec implements LanguageSpec {
  suffix: string = "ts";
  languageId: string = "typescript";

  indentInferred = javaIndentInferred;

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    // It's possible to run launch.json configurations with `vscode.debug.startDebugging(fs, "Extension Tests");`
    // But `npm run test` currently does everything we need, but an option to keep in mind if ever needed.
    return stubs.sendTerminalCommandFunc(args, `npm run test`);
  }
}

class JavascriptSpec extends TypescriptSpec {
  suffix: string = "js";
  languageId: string = "javascript";

  indentInferred = javaIndentInferred;
}

class MochaSpec extends JavascriptSpec {
  suffix: string = "mjs";
  languageId: string = "mocha-javascript?";
}

class JsonSpec extends TypescriptSpec {
  suffix: string = "json";
  languageId: string = "json";
}

class UnknownSpec implements LanguageSpec {

  suffix: string;
  languageId: string;

  constructor(fileIdentifier: string) {
    this.suffix = fileIdentifier;
    this.languageId = fileIdentifier;
  }

  async testingBehavior(args: TestFileArgs, file: vscode.Uri) {
    if (!args || args.part === 0) {
      vscode.window.showErrorMessage(`Unknown file suffix: ${this.suffix}`);
    }
  }
}

const LANGUAGE_SPECS: LanguageSpec[] = [
  new GoSpec(),
  new PythonSpec(),
  new JavaSpec(),
  new TypescriptSpec(),
  new JavascriptSpec(),
  new MochaSpec(),
  new JsonSpec(),
];

const SUFFIX_TO_SPEC: Map<string, LanguageSpec> = new Map<string, LanguageSpec>(
  LANGUAGE_SPECS.map(languageSpec => [languageSpec.suffix, languageSpec])
);

const LANGUAGE_ID_TO_SPEC: Map<string, LanguageSpec> = new Map<string, LanguageSpec>(
  LANGUAGE_SPECS.map(languageSpec => [languageSpec.languageId, languageSpec])
);

export function getLanguageSpec(document: vscode.TextDocument): LanguageSpec
export function getLanguageSpec(uri: vscode.Uri): LanguageSpec
export function getLanguageSpec(input: vscode.TextDocument | vscode.Uri): LanguageSpec {
  if (input instanceof vscode.Uri) {
    const suffix = input.fsPath.split(".").pop()!;
    return SUFFIX_TO_SPEC.get(suffix) || new UnknownSpec(suffix);
  }

  // Otherwise, is a TextDocument
  return LANGUAGE_ID_TO_SPEC.get(input.languageId) || new UnknownSpec(input.languageId);
}

export function guessLanguageSpec(): LanguageSpec | undefined {
  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    return getLanguageSpec(document);
  }
}
