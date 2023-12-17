import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CtrlGCommand, CursorMove, DeleteCommand, setGroogContext } from './interfaces';
import { Emacs } from './emacs';
import AwaitLock from 'await-lock';

export interface RegisterCommandOptionalProps {
  noLock?: boolean;
  noTimeout?: boolean;
}

export class Recorder extends TypeHandler {
  // baseCommand ensures we don't infinite loop a command. For example,
  // if groog.CommandOne calls groog.CommandTwo, then we would record
  // both of them. But in the replay we would call groog.CommandOne (which would
  // call groog.CommandTwo) and then call groog.CommandTwo ourselves. Therefore,
  // groog.CommandTwo would be executed twice in the replay even though it only
  // happened once during recording.
  private baseCommand: boolean;
  private recordBook: Record[];
  private lastFind: FindNextRecord | undefined;
  // Note: we would never need these in persistent memory
  // because any recording I'd want public I could
  // just create an equivalent vscode function.
  private namedRecordings: Map<string, Record[]>;
  private emacs: Emacs;
  private readonly typeLock: AwaitLock;

  // TODO: Make readonly
  whenContext: string = "record";
  private readonly recordFindContext = "record.find";
  private recordFindContextLocal = false;

  async setFindContext(to: boolean) {
    return setGroogContext(this.recordFindContext, to).then(() => { this.recordFindContextLocal = to; });
  }

  constructor(cm: ColorMode, emacs: Emacs) {
    super(cm, ModeColor.record);
    this.baseCommand = true;
    this.recordBook = [];
    this.namedRecordings = new Map<string, Record[]>();
    this.emacs = emacs;
    this.typeLock = new AwaitLock();
  }

  // I encountered an issue when coding with VSCode + SSH + QMK keyboard setup. Basically,
  // the keycodes would be sent in such rapid succession (either b/c of send_string or tap dance logic),
  // that their order would become mixed up due to the parallel nature of commands (which run async).
  // The initialization of command executions, however, are well ordered, so requiring a lock
  // immediately has proven to be a great solution to this problem.
  public lockWrap<T>(name: string, f: (t: T) => Thenable<void>, noTimeout?: boolean): (t: T) => Thenable<void> {
    return async (t: T) => await this.typeLock.acquireAsync()
      .then(() => noTimeout ? undefined : setTimeout(() => vscode.window.showErrorMessage(`LockWrap "${name}" is taking too long`), 5_000))
      .then((timeoutRef) => f(t).then(() => noTimeout ? undefined : clearTimeout(timeoutRef)))
      .finally(() => this.typeLock.release());
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "record.startRecording", () => recorder.startRecording());
    recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
    recorder.registerCommand(context, "record.saveRecordingAs", () => recorder.saveRecordingAs());
    recorder.registerCommand(context, "record.deleteRecording", () => recorder.deleteRecording());
    recorder.registerCommand(context, "record.find", () => recorder.find(), {noTimeout: true});
    // This needs to have noLock true because it runs simultaneously with the record.find command
    // when pressing ctrl+s twice.
    recorder.registerCommand(context, "record.findNext", () => recorder.findNext(), {noLock: true});

    // We don't lock on playbacks because they are nested commands.
    recorder.registerCommand(context, "record.playRecording", () => recorder.playback(), {noLock: true});
    recorder.registerCommand(context, "record.playNamedRecording", () => recorder.playbackNamedRecording(), {noLock: true});
  }

  registerCommand(context: vscode.ExtensionContext, commandName: string, callback: (...args: any[]) => Thenable<any>, optionalProps?: RegisterCommandOptionalProps) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName,
      optionalProps?.noLock ? (...args: any) => this.execute("groog." + commandName, args, callback) : this.lockWrap("groog." + commandName, (...args: any) => this.execute("groog." + commandName, args, callback), optionalProps?.noTimeout)
    ));
  }

  registerUnrecordableCommand(context: vscode.ExtensionContext, commandName: string, callback: (...args: any[]) => any) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName, this.lockWrap("groog." + commandName, callback)));
  }

  async execute(command: string, args: any[], callback: (...args: any[]) => any) {
    if (command.includes("groog.record") || !this.isActive() || !this.baseCommand) {
      await callback(...args);
      return;
    }
    await this.addRecord(new CommandRecord(command, args));
    this.baseCommand = false;
    await callback(...args);
    this.baseCommand = true;
  }

  async findNext() {
    if (!this.lastFind) {
      vscode.window.showErrorMessage(`This recording hasn't executed a find command yet.`);
      return;
    }
    await this.lastFind.playback().then(() => {
      if (this.lastFind) {
        return this.addRecord(this.lastFind!);
      };
    });
  }

  async find() {
    return await this.setFindContext(true).then(() => vscode.window.showInputBox({
      placeHolder: "Search query",
      prompt: "Search text",
      // value: selectedText
    }).then(
      (searchQuery) => {
        if (searchQuery) {
          this.lastFind = new FindNextRecord(searchQuery);
          return this.findNext();
        }
      },
    )).then(
      () => {}, // Do nothing on fulfilled
      () => this.setFindContext(false),
    );
  }

  async startRecording() {
    if (this.isActive()) {
      vscode.window.showErrorMessage("Already recording!");
    } else {
      this.activate();
      this.recordBook = [];
      vscode.window.showInformationMessage("Recording started!");
    }
  }

  async saveRecordingAs() {
    if (!this.isActive()) {
      vscode.window.showErrorMessage("Not recording!");
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

  async endRecording() {
    if (!this.isActive()) {
      vscode.window.showInformationMessage("Not recording!");
    } else {
      this.deactivate();
      vscode.window.showInformationMessage("Recording ended!");
    }
  }

  async deleteRecording() {
    if (this.isActive()) {
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
    this.namedRecordings.delete(result);
  }

  async playbackNamedRecording() {
    if (this.isActive()) {
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
    this.playRecords(nr);
  }

  async playRecords(records : Record[]) {
    for (var r of records) {
      if (!await r.playback(this.emacs)) {
        break;
      };
    }
  }

  async playback(): Promise<void> {
    if (this.isActive()) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }
    vscode.window.showInformationMessage("Playing recording!");
    return this.playRecords(this.recordBook);
  }

  async handleActivation() {}

  async handleDeactivation() {
    this.lastFind = undefined;
    await vscode.commands.executeCommand("closeFindWidget");
  }

  addRecord(r: Record) {
    if (this.baseCommand) {
      this.recordBook = this.recordBook.concat(r);
    }
  }

  async textHandler(s: string): Promise<boolean> {
    if (this.recordFindContextLocal) {
      await this.setFindContext(false);
      await vscode.commands.executeCommand(CtrlGCommand.closeFindWidget);
      this.addRecord(new CommandRecord(CtrlGCommand.closeFindWidget));
    }
    this.addRecord(new TypeRecord(s));
    return true;
  }

  // All these functions are associated with a "groog.*" command so these are
  // already added to the record book via the "type" command handling
  async onKill(s: string | undefined) { }
  alwaysOnKill: boolean = false;
  async ctrlG() {
    await setGroogContext(this.recordFindContext, false);
  }
  async onYank() { }
  alwaysOnYank: boolean = false;
  async delHandler(s: DeleteCommand): Promise<boolean> {
    return true;
  }
  async moveHandler(vsCommand: CursorMove, ...rest: any[]): Promise<boolean> {
    return true;
  }
}

interface Record {
  name(): string;
  playback(emacs: Emacs): Promise<boolean>;
}

class TypeRecord implements Record {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  async playback(emacs: Emacs): Promise<boolean> {
    // await vscode.commands.executeCommand("type", { "text": this.text });
    return emacs.typeBonusFeatures(this.text).then(() => true).catch((reason: any) => {
      vscode.window.showErrorMessage("WUT: " + reason);
      return false;
    });
  }

  name(): string {
    return "TR: " + this.text;
  }
}

class CommandRecord implements Record {
  command: string;
  args: any[];

  constructor(command: string, args?: any[]) {
    this.command = command;
    this.args = args || [];
  }

  async playback(): Promise<boolean> {
    await vscode.commands.executeCommand(this.command, ...this.args);
    return true;
  }

  name(): string {
    return "CR: " + this.command;
  }
}

class FindNextRecord implements Record {
  findText: string;

  constructor(findText: string) {
    this.findText = findText;
  }

  async playback(): Promise<boolean> {
    await vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": this.findText });
    await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
    // Can also do the following command instead of focusActiveEditorGroup:
    // await vscode.commands.executeCommand("closeFindWidget");
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Cannot get active text editor for find playback");
      return false;
    }

    if (editor.selection.isEmpty) {
      vscode.window.showErrorMessage("No match found in find playback");
      return false;
    }
    return true;
  }

  name(): string {
    return "FNR: " + this.findText;
  }
}
