// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {Emacs, cursorMoves, deleteCommands} from './emacs';
import {Recorder} from './record';
import {multiCommand} from './multi-command';

let baseCommand = true;
let recording = false;

const recorder = new Recorder();
const groogery = new Emacs(recorder);

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("yupo");
  for (var move of cursorMoves) {
    const m = move;
    recorder.registerCommand(context, move, () => groogery.move(m));
  }
  for (var dc of deleteCommands) {
    const d = dc;
    recorder.registerCommand(context, d, () => groogery.delCommand(d));
  }
  context.subscriptions.push(vscode.commands.registerCommand('type', (...args: any[]) => {
    groogery.type(...args);
  }));
  recorder.registerCommand(context, 'jump', () => groogery.jump());
  recorder.registerCommand(context, 'fall', () => groogery.fall());

  recorder.registerCommand(context, 'toggleQMK', () => groogery.toggleQMK());
  recorder.registerCommand(context, 'yank', () => groogery.yank());
  recorder.registerCommand(context, 'kill', () => groogery.kill());
  recorder.registerCommand(context, 'ctrlG', () => groogery.ctrlG());
  recorder.registerCommand(context, "multiCommand.execute", multiCommand);

  for (var th of groogery.typeHandlers) {
    th.register(context, recorder);
  }
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "groog" is now active in the web extension host!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('groog.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from groog in a web extension host!');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
