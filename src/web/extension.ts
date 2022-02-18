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

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
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
}

// this method is called when your extension is deactivated
export function deactivate() {}
