// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {Emacs, cursorMoves} from './emacs';
import {Recorder} from './record';
import {multiCommand} from './multi-command';

let baseCommand = true;
let recording = false;

function register(context: vscode.ExtensionContext, commandName: string, callback: (...args: any[]) => any) {
  context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, (...args: any) => {
    recorder.Execute("groog." + commandName, args, callback);
  }));
}

const groogery = new Emacs();
const recorder = new Recorder();

let bet = "qwertyuiopasdfghjklzxcvbnm";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("yupo");
  for (var b of bet) {
    const lb = b;
    const ub = b.toUpperCase();
    register(context, lb, () => {
      vscode.commands.executeCommand("type", { "text": lb});
    });
    register(context, ub, () => {
      vscode.commands.executeCommand("type", { "text": ub});
    });
  }
  /*register(context, "a", () => {
    vscode.window.showInformationMessage("lower a");
  });
  register(context, "A", () => {
    vscode.window.showInformationMessage("upper a");
  });*/
  /*register(context, "A", () => {
    vscode.window.showInformationMessage("upper a");
  });*/
  for (var move of cursorMoves) {
    const m = move;
    register(context, move, () => groogery.move(m));
  }
  register(context, 'jump', () => groogery.jump());
  register(context, 'fall', () => groogery.fall());

  register(context, 'toggleQMK', () => groogery.toggleQMK());
  register(context, 'toggleMarkMode', () => groogery.toggleMarkMode());
  register(context, 'yank', () => groogery.yank());
  register(context, 'paste', () => groogery.paste());
  register(context, 'kill', () => groogery.kill());
  register(context, 'ctrlG', () => groogery.ctrlG());
  register(context, "multiCommand.execute", multiCommand);
  register(context, "record.startRecording", () => recorder.StartRecording());
  register(context, "record.endRecording", () => recorder.EndRecording());
  register(context, "record.playRecording", () => recorder.Playback());
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
