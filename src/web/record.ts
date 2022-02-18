import * as vscode from 'vscode';

export class Recorder {
  private baseCommand: boolean;
  private recording: boolean;
  private recordBook: record[];

  constructor() {
    this.baseCommand = true;
    this.recording = false;
    this.setRecording(false);
    this.recordBook = [];
  }

  setRecording(b: boolean) {
    vscode.commands.executeCommand('setContext', 'groog.recording', b);
    this.recording = b;
  }

  Execute(command: string, args: any[], callback: (...args: any[]) => any): any {
    if (command.includes("groog.record") || !this.recording || !this.baseCommand) {
      return callback(...args);
    }
    this.recordBook = this.recordBook.concat(new record(command, args));
    this.baseCommand = false;
    let r = callback(...args);
    this.baseCommand = true;
    return r;
  }

  StartRecording() {
    if (this.recording) {
      vscode.window.showInformationMessage("Already recording!");
    } else {
      this.setRecording(true);
      this.recordBook = [];
      vscode.window.showInformationMessage("Recording started!");
    }
  }

  EndRecording() {
    if (!this.recording) {
      vscode.window.showInformationMessage("Not recording!");
    } else {
      this.setRecording(false);
      vscode.window.showInformationMessage("Recording ended!");
    }
  }

  Playback() {
    if (this.recording) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }
    vscode.window.showInformationMessage("Playing recording!");
    let sl: string[] = [];
    for (var record of this.recordBook) {
      vscode.commands.executeCommand(record.command, ...record.args);
    }
  }
}

class record {
  command: string;
  args: any[];

  constructor(command: string, args: any[]) {
    this.command = command;
    this.args = args;
  }
}