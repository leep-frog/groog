import * as vscode from 'vscode';
import { TestFileArgs } from "./misc-command";
import { stubs } from './stubs';
import path = require('path');


export interface LanguageSpec {
  suffix: string;
  testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<any>;
  // TODO: copyImport
  // TODO: inferIndent
}

class GoSpec implements LanguageSpec {
  suffix: string = "go";

  async testingBehavior(): Promise<void> {
    vscode.window.showErrorMessage(`go testing should be routed to custom command in keybindings.go`);
  }
}

class PythonSpec implements LanguageSpec {
  suffix: string = "py";

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    return stubs.sendTerminalCommandFunc(args, `prt ${file.fsPath}`);
  }
}

class JavaSpec implements LanguageSpec {
  suffix: string = "java";

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    const javaTestCommand = `zts ${path.parse(file.fsPath).name}`;
    return stubs.sendTerminalCommandFunc(args, javaTestCommand);
  }
}

class TypescriptSpec implements LanguageSpec {
  suffix: string = "ts";

  async testingBehavior(args: TestFileArgs, file: vscode.Uri): Promise<void> {
    // It's possible to run launch.json configurations with `vscode.debug.startDebugging(fs, "Extension Tests");`
    // But `npm run test` currently does everything we need, but an option to keep in mind if ever needed.
    return stubs.sendTerminalCommandFunc(args, `npm run test`);
  }
}

class JavascriptSpec extends TypescriptSpec {
  suffix: string = "js";
}

class MochaSpec extends TypescriptSpec {
  suffix: string = "mjs";
}

class JsonSpec extends TypescriptSpec {
  suffix: string = "json";
}

class UnknownSpec implements LanguageSpec {

  suffix: string;

  constructor(suffix: string) {
    this.suffix = suffix;
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

export function getLanguageSpec(file: vscode.Uri): LanguageSpec {
  const suffix = file.fsPath.split(".").pop()!;
  return SUFFIX_TO_SPEC.get(suffix) || new UnknownSpec(suffix);
}
