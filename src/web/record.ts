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
  private lastFind: FindNextRecord | undefined;
  // TODO: Would we ever want these in persistent memory?
  //       Don't think so unless we made package public.
  //       Otherwise, any recording I'd want public I could
  //       just create an equivalent vscode function.
  private namedRecordings: Map<string, Record[]>;

  constructor() {
    this.baseCommand = true;
    this.active = false;
    this.recordBook = [];
    this.namedRecordings = new Map<string, Record[]>();
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "record.startRecording", () => recorder.startRecording());
    recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
    recorder.registerCommand(context, "record.saveRecordingAs", () => recorder.saveRecordingAs());
    recorder.registerCommand(context, "record.playRecording", () => recorder.playback());
    recorder.registerCommand(context, "record.playNamedRecording", () => recorder.playbackNamedRecording());
    recorder.registerCommand(context, "record.find", () => recorder.find());
    recorder.registerCommand(context, "record.findNext", () => recorder.findNext());
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

  // TODO: findPrev
  async findNext() {
    if (!this.lastFind) {
      vscode.window.showErrorMessage("No find text has been set yet");
      return;
    }
    this.lastFind.playback();
    this.addRecord(this.lastFind);
  }

  async find() {
    vscode.window.showInformationMessage("inputting");
    const searchQuery = await vscode.window.showInputBox({
      placeHolder: "Search query",
      prompt: "Search text",
      //value: selectedText
    });
    vscode.window.showInformationMessage("got: " + searchQuery);
    if (searchQuery) {
      this.lastFind = new FindNextRecord(searchQuery);
      await this.findNext();
    }
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

  async saveRecordingAs() {
    if (!this.active) {
      vscode.window.showInformationMessage("Not recording!");
      return;
    }

    const searchQuery = await vscode.window.showInputBox({
      placeHolder: "Recording name",
      prompt: "Save recording as...",
      title: "Save recording as:",
    });

    // Save recording as if a name was provided.
    if (searchQuery) {
      this.namedRecordings.set(searchQuery, this.recordBook);
      vscode.window.showInformationMessage(`Recording saved as "${searchQuery}"!`);
    } else {
      vscode.window.showErrorMessage("No recording name provided");
    }
    this.deactivate();
    vscode.window.showInformationMessage("Recording ended!");
  }

  endRecording() {
    if (!this.active) {
      vscode.window.showInformationMessage("Not recording!");
    } else {
      this.deactivate();
      vscode.window.showInformationMessage("Recording ended!");
    }
  }

  async playbackNamedRecording() {
    if (this.active) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }
    const result = await vscode.window.showQuickPick(
      [...this.namedRecordings.keys()].sort((a: string, b: string): number => {
        return a < b ? -1 : 1;
      }),
      {
        placeHolder: "Recording name",
        title: "Choose Recording to play",
      },
    );
    if (!result) {
      vscode.window.showErrorMessage("No recording chosen");
      return;
    }
    let nr = this.namedRecordings.get(result);
    if (!nr) {
      vscode.window.showErrorMessage(`Unknown recording "${result}"`);
      return;
    }
    vscode.window.showInformationMessage(`Playing back "${result}"`);
    for (var r of nr) {
      await r.playback();
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
    this.lastFind = undefined;
    vscode.commands.executeCommand('setContext', 'groog.recording', false);
    vscode.commands.executeCommand("closeFindWidget");
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

class FindNextRecord implements Record {
  findText: string;

  constructor(findText: string) {
    this.findText = findText;
  }

  async playback(): Promise<void> {
    await vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": this.findText });
    await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
  }
}