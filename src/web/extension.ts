// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {Emacs} from './emacs';
import {Recorder} from './record';
import {multiCommand} from './multi-command';

const recorder = new Recorder();
const groogery = new Emacs(recorder);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  groogery.register(context, recorder);
  recorder.registerCommand(context, "multiCommand.execute", multiCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {}
