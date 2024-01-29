import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CtrlGCommand, CursorMove, DeleteCommand, setGroogContext } from './interfaces';
import { Emacs } from './emacs';
import AwaitLock from 'await-lock';
import { FindHandler } from './find';

export interface RegisterCommandOptionalProps {
  noLock?: boolean;
  noTimeout?: boolean;
}

const RECENT_RECORDING_PREFIX = "Recent recording";
const MAX_RECORDINGS = 3;

export class Recorder extends TypeHandler {
  // baseCommand ensures we don't infinite loop a command. For example,
  // if groog.CommandOne calls groog.CommandTwo, then we would record
  // both of them. But in the replay we would call groog.CommandOne (which would
  // call groog.CommandTwo) and then call groog.CommandTwo ourselves. Therefore,
  // groog.CommandTwo would be executed twice in the replay even though it only
  // happened once during recording.
  private baseCommand: boolean;
  private recordBooks: Record[][];
  // Note: we would never need these in persistent memory
  // because any recording I'd want public I could
  // just create an equivalent vscode function.
  private namedRecordings: Map<string, Record[]>;
  private emacs: Emacs;
  private readonly typeLock: AwaitLock;
  private finder?: FindHandler;

  readonly whenContext: string = "record";

  constructor(cm: ColorMode, emacs: Emacs) {
    super(cm, ModeColor.record);
    this.baseCommand = true;
    this.recordBooks = [];
    this.namedRecordings = new Map<string, Record[]>();
    this.emacs = emacs;
    this.typeLock = new AwaitLock();
  }

  public setFinder(finder: FindHandler) {
    this.finder = finder;
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
    recorder.registerCommand(context, "record.undo", () => recorder.undo());

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
    if (command.startsWith("groog.record") || command.startsWith("groog.find") || this.finder?.isActive() || !this.isActive() || !this.baseCommand) {
      await callback(...args);
      return;
    }
    await this.addRecord(new CommandRecord(command, args));
    this.baseCommand = false;
    await callback(...args);
    this.baseCommand = true;
  }

  getRecordBook(): Record[] { return this.recordBooks.at(-1)!; }

  setRecordBook(newBook: Record[]) { this.recordBooks[this.recordBooks.length-1] = newBook; }

  async undo() {
    const lastRecord = this.getRecordBook().at(-1);

    if (!lastRecord) {
      vscode.window.showInformationMessage(`nope`);
      return;
    }

    lastRecord.undo().then(succeeded => {
      if (!succeeded) {
        vscode.window.showInformationMessage(`Undo failed`);
      } else {
        this.getRecordBook().pop();
      }
    });
  }

  async startRecording() {
    if (this.isActive()) {
      vscode.window.showErrorMessage("Already recording!");
    } else {
      this.activate();
      this.recordBooks.push([]);
      vscode.window.showInformationMessage("Recording started!");
    }
  }

  recordNameValidator(name: string): vscode.InputBoxValidationMessage | undefined {
    if (name.startsWith(RECENT_RECORDING_PREFIX)) {
      return {
        message: "This is a reserved prefix",
        severity: vscode.InputBoxValidationSeverity.Error,
      };
    }

    if (this.namedRecordings.has(name)) {
      return {
        message: "This record already exists",
        severity: vscode.InputBoxValidationSeverity.Error,
      };
    }
  }

  async saveNewRec(recordBook: Record[]): Promise<void> {
    const recordingName = await vscode.window.showInputBox({
      title: "Save recording as:",
      placeHolder: "Recording name",
      // Need the wrapping, otherwise hangs for some reason.
      validateInput: (name => this.recordNameValidator(name)),
    });
    if (recordingName) {
      this.namedRecordings.set(recordingName, recordBook);
      vscode.window.showInformationMessage(`Recording saved as "${recordingName}"!`);
    } else {
      vscode.window.showErrorMessage("No recording name provided");
    }
  }

  async saveRecordingAs() {
    if (!this.isActive()) {
      vscode.window.showErrorMessage("Not recording!");
      return;
    }
    this.setRecordBook(trimRecords(this.getRecordBook()));

    this.saveNewRec(this.getRecordBook());
    this.deactivate();
    vscode.window.showInformationMessage("Recording ended!");
  }

  async endRecording() {
    if (!this.isActive()) {
      vscode.window.showInformationMessage("Not recording!");
    } else {
      this.setRecordBook(trimRecords(this.getRecordBook()));
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
      return;
    }
    this.namedRecordings.delete(result);
  }

  async playbackNamedRecording() {
    if (this.isActive()) {
      vscode.window.showInformationMessage("Still recording!");
      return;
    }

    // Create items
    const recentItems: RecordBookQuickPickItem[] = this.recordBooks.map((recordBook, idx) => { return {
      recordBook: recordBook,
      buttons: [new SaveRecentRecordingButton()],
      label: `${RECENT_RECORDING_PREFIX} ${this.recordBooks.length - 1 - idx}`,
    };}).reverse();

    const items: RecordBookQuickPickItem[] = [...this.namedRecordings.entries()]
      .map((a: [string, Record[]]): RecordBookQuickPickItem => { return {
        recordBook: a[1],
        label: a[0],
      };})
      .sort((a, b) => a.label < b.label ? -1 : 1);

    // Create quick pick
    const disposables: vscode.Disposable[] = [];
    const input = vscode.window.createQuickPick<RecordBookQuickPickItem>();
    input.items = [
      ...recentItems,
      ...items,
    ];
    input.title = "Choose Recording to play";
    input.placeholder = "Recording name";

    disposables.push(
      // Dispose of events when leaving the widget.
      input.onDidHide(e => {
        disposables.forEach(d => d.dispose);
      }),
      // When pressing a button
      input.onDidTriggerItemButton(event => {
        input.dispose();
        this.saveNewRec(event.item.recordBook);
      }),
      // When accepting an event, run the record book!
      input.onDidAccept(e => {
        switch (input.selectedItems.length) {
        case 0:
          vscode.window.showInformationMessage("No selection made");
          break;
        case 1:
          this.playRecords(input.selectedItems[0].recordBook);
          break;
        default:
          vscode.window.showErrorMessage(`Multiple selections made somehow?!`);
          break;
        };
        input.dispose();
      }),
    );

    return input.show();
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
    return this.playRecords(this.getRecordBook());
  }

  async handleActivation() {}

  async handleDeactivation() {
    if (this.recordBooks.length > MAX_RECORDINGS) {
      this.recordBooks = this.recordBooks.slice(this.recordBooks.length - MAX_RECORDINGS);
    }
    await vscode.commands.executeCommand("closeFindWidget");
  }

  addRecord(r: Record) {
    if (this.baseCommand && !this.finder?.isActive()) {
      this.setRecordBook(this.getRecordBook().concat(r));
    }
  }

  async textHandler(s: string): Promise<boolean> {
    this.addRecord(new TypeRecord(s));
    return true;
  }

  // All these functions are associated with a "groog.*" command so these are
  // already added to the record book via the "type" command handling
  async onKill(s: string | undefined) { }
  alwaysOnKill: boolean = false;
  async ctrlG() {
    return true;
  }
  async onYank() { }
  alwaysOnYank: boolean = false;
  async onPaste(text: string): Promise<boolean> {
    return true;
  }
  async onEmacsPaste(text: string): Promise<boolean> {
    return true;
  }
  async delHandler(s: DeleteCommand): Promise<boolean> {
    return true;
  }
  async moveHandler(vsCommand: CursorMove, ...rest: any[]): Promise<boolean> {
    return true;
  }
}

function trimRecords(records: Record[]): Record[] {
  if (records.length === 0) {
    return [];
  }

  const newRecords: Record[] = [];
  for (const record of records) {
    const lastRecord = newRecords.at(-1);

    // If no previous records, or the next record can't be eaten, then add to the array.
    if (!lastRecord || !lastRecord.eat(record)) {
      newRecords.push(record);
      continue;
    }

    // If the next record was eaten and resulted in a no-op record, then pop that.
    if (lastRecord.noop()) {
      newRecords.pop();
    }
  }

  return newRecords;
}

export interface Record {
  name(): string;

  playback(emacs: Emacs): Promise<boolean>;

  // undo undoes the record and returns a boolean indicating if the undo operation was successful.
  undo(): Promise<boolean>;

  // eat attempts to eat the next record and returns whether it did or not.
  eat(next: Record): boolean;

  // Whenever a record is eaten, we check if it has become an effectively no-op (in which
  // case it will be removed)
  noop(): boolean;
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

  noop(): boolean {
    return this.text.length === 0;
  }

  eat(next: Record): boolean {
    switch (next.constructor) {
    case TypeRecord:
      const tr = <TypeRecord>next;
      this.text += tr.text;
      return true;

    case CommandRecord:
      const cr = <CommandRecord>next;
      // TODO "groog." prefix to helper method
      if (cr.command === `groog.${DeleteCommand.left}`) {
        // Length will not be zero because it will be popped by the noop check.
        this.text = this.text.slice(0, this.text.length-1);
        return true;
      }
      return false;
    }

    return false;
  }

  async undo() {
    return vscode.commands.executeCommand('deleteLeft').then(() => true, () => false);
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

  noop(): boolean {
    return false;
  }

  eat(next: Record): boolean {
    return false;
  }

  async undo() {
    // TODO: Map from command to command that reverts (e.g. groog.jump, groog.fall?)
    // Maybe not cuz jump at the end of a file won't behave properly, but still
    // an approach for other commands?
    return false;
  }
}

interface RecordBookQuickPickItem extends vscode.QuickPickItem {
  recordBook: Record[];
}

class SaveRecentRecordingButton implements vscode.QuickInputButton {
  readonly iconPath: vscode.ThemeIcon;
  readonly tooltip?: string;
  constructor() {
    this.iconPath = new vscode.ThemeIcon("save");
    this.tooltip = "Save recording as...";
  }
}
