import * as vscode from 'vscode';
import { TypeHandler } from './interfaces';

export class Recorder implements TypeHandler {
  // baseCommand ensures we don't infinite loop a command. For example,
  // if groog.CommandOne calls groog.CommandTwo, then we would record
  // both of them. But in the replay we would call groog.CommandOne (which would
  // call groog.CommandTwo) and then call groog.CommandTwo ourselves. Therefore,
  // groog.CommandTwo would be executed twice in the replay even though it only
  // happened once during recording.
  private baseCommand: boolean;
  active: boolean; // aka "recording"
  private recordBook: Record[];
  //private findMode: boolean;

  constructor() {
    this.baseCommand = true;
    this.active = false;
    this.recordBook = [];
    //this.findMode = false;
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "record.startRecording", () => recorder.startRecording());
    recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
    recorder.registerCommand(context, "record.playRecording", () => recorder.playback());
    recorder.registerCommand(context, "record.find", () => recorder.find());
  }

  registerCommand(context: vscode.ExtensionContext, commandName: string, callback: (...args: any[]) => any) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, (...args: any) => {
      this.execute("groog." + commandName, args, callback);
    }));
  }

  execute(command: string, args: any[], callback: (...args: any[]) => any): any {
    if (command.includes("groog.record") || !this.active || !this.baseCommand) {
      return callback(...args);
    }
    this.addRecord(new CommandRecord(command, args));
    this.baseCommand = false;
    let r = callback(...args);
    this.baseCommand = true;
    return r;
  }

  async find() {
    /*if (!this.findMode) {
      // Find mode is being activated
      await vscode.commands.executeCommand("editor.actions.findWithArgs");
      this.findMode = true;
    } else {
      // Otherwise, moving to the next one
      await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
      // TODO: Record this action.
    }
    /*
      ctrl+s enter find mode
      ctrl+g end find mode
      record number of next matches
    */
    /*const searchQuery = await vscode.window.showInputBox({
      placeHolder: "Search query",
      prompt: "Search text",
      //value: selectedText
    });
    if (searchQuery) {
      vscode.window.showInformationMessage("heyo: " + searchQuery);
    }*/
  }

  startRecording() {
    if (this.active) {
      vscode.window.showInformationMessage("Already recording!");
    } else {
      this.activate();
      this.recordBook = [];
      vscode.window.showInformationMessage("Recording started!");
    }
  }

  endRecording() {
    if (!this.active) {
      vscode.window.showInformationMessage("Not recording!");
    } else {
      this.deactivate();
      vscode.window.showInformationMessage("Recording ended!");
    }
  }

  async playback() {
    if (this.active) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }
    vscode.window.showInformationMessage("Playing recording!");
    for (var r of this.recordBook) {
      await r.playback();
    }
    // TODO: not sure if this is identical
    // this.recordBook.map(async (r) => await r.playback());
  }

  activate() {
    this.active = true;
    vscode.commands.executeCommand('setContext', 'groog.recording', true);
  }

  deactivate() {
    this.active = false;
    //this.findMode = false;
    // TODO: Stop record-find prompt
    // TODO: find and replace? maybe not needed since we can just do find and replace through
    // existing find widget.
    vscode.commands.executeCommand('setContext', 'groog.recording', false);

  }

  addRecord(r: Record) {
    this.recordBook = this.recordBook.concat(r);
  }

  textHandler(s: string): boolean {
    this.addRecord(new TypeRecord(s));
    return true;
  }

  // All these functions are associated with a "groog.*" command so these are
  // already added to the record book via the "type" command handling
  onKill(s: string | undefined) { }
  alwaysOnKill(): boolean { return false; }
  ctrlG() { }
  onYank(s: string | undefined) { }
  alwaysOnYank(): boolean { return false; }
  delHandler(s: string): boolean {
    return true;
  }
  moveHandler(vsCommand: string, ...rest: any[]): boolean {
    return true;
  }
}

interface Record {
  playback(): Promise<void>;
}

class TypeRecord implements Record {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  async playback(): Promise<void> {
    await vscode.commands.executeCommand("type", { "text": this.text });
  }
}

class CommandRecord implements Record {
  command: string;
  args: any[];

  constructor(command: string, args: any[]) {
    this.command = command;
    this.args = args;
  }

  async playback(): Promise<void> {
    await vscode.commands.executeCommand(this.command, ...this.args);
  }
}
