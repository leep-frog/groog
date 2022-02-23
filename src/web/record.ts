import * as vscode from 'vscode';

export class Recorder {
  private baseCommand: boolean;
  active: boolean; // aka "recording"
  private recordBook: Record[];

  constructor() {
    this.baseCommand = true;
    this.active = false;
    this.recordBook = [];
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "record.startRecording", () => recorder.startRecording());
    recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
    recorder.registerCommand(context, "record.playRecording", () => recorder.playback());
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
    this.addRecord(new Record(command, args));
    this.baseCommand = false;
    let r = callback(...args);
    this.baseCommand = true;
    return r;
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

  playback() {
    if (this.active) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }
    vscode.window.showInformationMessage("Playing recording!");
    let sl: string[] = [];
    for (var record of this.recordBook) {
      sl.push(record.command);
      vscode.commands.executeCommand(record.command, ...record.args);
    }
    vscode.window.showInformationMessage("playing: " + sl.join("\n"));
  }

  activate() {
    this.active = true;
    vscode.commands.executeCommand('setContext', 'groog.recording', true);
  }

  deactivate() {
    this.active = false;
    vscode.commands.executeCommand('setContext', 'groog.recording', false);

  }

  addRecord(r: Record) {
    this.recordBook = this.recordBook.concat(r);
  }

  textHandler(s: string): boolean {
    vscode.window.showInformationMessage("rec text " + s);
    this.addRecord(new Record("type", [{ "text": s}]));
    return true;
  }
  
  // All these functions are associated with a "groog.*" command so these are
  // already added to the record book via the "type" command handling
  onKill(s: string | undefined) {}
  ctrlG() {}
  onYank(s: string | undefined) {}
  delHandler(s: string): boolean {
    return true;
  }
  moveHandler(vsCommand: string, ...rest: any[]): boolean {
    return true;
  }
}

class Record {
  command: string;
  args: any[];

  constructor(command: string, args: any[]) {
    this.command = command;
    this.args = args;
  }
}