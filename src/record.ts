import AwaitLock from 'await-lock';
import * as vscode from 'vscode';
import { ColorMode, HandlerColoring, gutterHandlerColoring } from './color_mode';
import { Emacs } from './emacs';
import { FindHandler, FindRecord } from './find';
import { TypeHandler } from './handler';
import { DeleteCommand } from './interfaces';

export interface RegisterCommandOptionalProps {
  noLock?: boolean;
  noTimeout?: boolean;
}

const RECENT_RECORDING_PREFIX = "Recent recording";
const MAX_RECORDINGS = 3;

export class RecordBook {
  records: Record[];
  locked: boolean;

  constructor() {
    this.records = [];
    this.locked = false;
  }

  async undo() {
    if (this.locked) {
      vscode.window.showErrorMessage(`Cannot undo a locked recording`);
      return;
    }

    const lastRecord = this.records.at(-1);

    if (!lastRecord) {
      return;
    }

    return lastRecord.undo().then(succeeded => {
      if (!succeeded) {
        vscode.window.showInformationMessage(`Undo failed`);
      } else {
        this.records.pop();
      }
    });
  }

  addRecord(r: Record): void {
    if (this.locked) {
      vscode.window.showErrorMessage(`Cannot add to a locked recording`);
    }
    this.records.push(r);
  }

  async playback(emacs: Emacs): Promise<boolean> {
    this.trimAndLock();
    for (var r of this.records) {
      if (!await r.playback(emacs)) {
        return false;
      };
    }
    return true;
  }

  private checkRepeatable(): FindRecord | undefined {
    this.trimAndLock();
    const firstRecord = this.records.at(0);
    return (firstRecord && (firstRecord.constructor === FindRecord)) ? firstRecord : undefined;
  }

  repeatable(): boolean {
    return !!this.checkRepeatable();
  }

  async repeatedPlayback(emacs: Emacs) {
    // Get the starting FindRecord
    const findRecord = this.checkRepeatable();
    if (!findRecord) {
      vscode.window.showErrorMessage(`This recording isn't repeatable`);
      return;
    }
    // All records after the findRecord.
    const nextRecords = this.records.slice(1);

    // Function that runs the FindRecord
    const alreadyChecked = new Set<number>();
    const totalNumMatches = -1;
    let decreaseMode: boolean | undefined = undefined;

    const runFindRecord = async (prevCount?: number): Promise<boolean> => {
      const success = await findRecord.playback(emacs, prevCount !== undefined /* Only display error on issue with first run */);
      if (!success) {
        return false;
      }

      if (prevCount !== undefined) {
        // Set decreaseMode if it is not set.
        if (decreaseMode === undefined) {
          decreaseMode = findRecord.numMatches < prevCount;
        }

        if (decreaseMode && findRecord.numMatches >= prevCount) {
          vscode.window.showErrorMessage(`Number of matches did not decrease, ending repeat playback`);
          return false;
        }

        if (!decreaseMode && findRecord.numMatches !== prevCount) {
          vscode.window.showErrorMessage(`Number of matches changed (${prevCount} -> ${findRecord.numMatches}), ending repeat playback`);
          return false;
        }

        if (!decreaseMode && alreadyChecked.has(findRecord.matchIdx)) {
          if (alreadyChecked.size === findRecord.numMatches) {
            vscode.window.showInformationMessage(`Successfully ran recording on all matches`);
          } else {
            vscode.window.showErrorMessage(`Landed on same match index, ending repeat playback`);
          }
          return false;
        }
      }
      alreadyChecked.add(findRecord.matchIdx);
      return true;
    };

    // Repeatedly run the FindRecord and then the rest of the records until we run out of matches or fail (and ensure that the number of matches is always decreasing)
    for (let success = await runFindRecord(); success; success = await runFindRecord(findRecord.numMatches)) {
      for (var r of nextRecords) {
        if (!await r.playback(emacs)) {
          return;
        };
      }
    }
  }

  async nPlaybacks(emacs: Emacs) {

    const opts: vscode.InputBoxOptions = {
      title: "Number of times to playback the recording",
      // Need the wrapping, otherwise hangs for some reason.
      validateInput: (input => {
        if (!/^\s*[1-9][0-9]*\s*$/.test(input)) {
          return "Input must be a positive integer";
        };
      }),
      prompt: "17",
    };

    const findRecord = this.checkRepeatable();
    if (findRecord) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(`No active text editor`);
        return;
      }

      const numMatches = findRecord.numberOfMatches(editor);
      opts.title += ` (${numMatches} matches found)`;
      opts.value = `${numMatches}`;
      opts.prompt = undefined;
    }

    const timesStr = await vscode.window.showInputBox(opts);

    if (!timesStr) {
      // If exitted input focus without entering
      return;
    }

    const times = +timesStr;
    for (let i = 0; i < times; i++) {
      if (!await this.playback(emacs)) {
        break;
      };
    }
  }

  trimAndLock(): void {
    if (this.locked) {
      return;
    }
    this.locked = true;

    if (this.records.length === 0) {
      return;
    }

    const newRecords: Record[] = [];
    for (const record of this.records) {
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

    this.records = newRecords;
  }
}

export class Recorder extends TypeHandler {
  // baseCommand ensures we don't infinite loop a command. For example,
  // if groog.CommandOne calls groog.CommandTwo, then we would record
  // both of them. But in the replay we would call groog.CommandOne (which would
  // call groog.CommandTwo) and then call groog.CommandTwo ourselves. Therefore,
  // groog.CommandTwo would be executed twice in the replay even though it only
  // happened once during recording.
  private baseCommand: boolean;
  private recordBooks: RecordBook[];
  // Note: we would never need these in persistent memory
  // because any recording I'd want public I could
  // just create an equivalent vscode function.
  private namedRecordings: Map<string, RecordBook>;
  private emacs: Emacs;
  private readonly typeLock: AwaitLock;
  private finder?: FindHandler;

  readonly whenContext: string = "record";

  constructor(cm: ColorMode, emacs: Emacs) {
    super(cm);
    this.baseCommand = true;
    this.recordBooks = [];
    this.namedRecordings = new Map<string, RecordBook>();
    this.emacs = emacs;
    this.typeLock = new AwaitLock();
  }

  async testReset() {
    this.recordBooks = [];
    this.namedRecordings.clear();
  }

  getColoring(context: vscode.ExtensionContext): HandlerColoring {
    return gutterHandlerColoring(context, "record");
  }

  public setFinder(finder: FindHandler) {
    this.finder = finder;
  }

  // I encountered an issue when coding with VSCode + SSH + QMK keyboard setup. Basically,
  // the keycodes would be sent in such rapid succession (either b/c of send_string or tap dance logic),
  // that their order would become mixed up due to the parallel nature of commands (which run async).
  // The initialization of command executions, however, are well ordered, so requiring a lock
  // immediately has proven to be a great solution to this problem.
  public lockWrap(name: string, f: (...t: any) => Thenable<void>, noTimeout?: boolean): (...t: any) => Thenable<void> {
    return async (...t: any) => await Promise.resolve()
      .then(() => this.emacs.outputChannel.log(`Starting command ${name} with args ${JSON.stringify(t)}`))
      .then(() => this.typeLock.acquireAsync())
      .then(() => noTimeout ? undefined : setTimeout(() => vscode.window.showErrorMessage(`LockWrap "${name}" is taking too long`), 5_000))
      .then((timeoutRef) => f(...t).then(() => noTimeout ? undefined : clearTimeout(timeoutRef)))
      .finally(() => {
        this.emacs.outputChannel.log(`Releasing command ${name} with args ${JSON.stringify(t)}`)
        this.typeLock.release()
      });
  }

  registerHandler(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, "record.startRecording", () => this.activate());
    recorder.registerCommand(context, "record.endRecording", () => recorder.endRecording());
    recorder.registerCommand(context, "record.saveRecordingAs", () => recorder.saveRecordingAs());
    recorder.registerCommand(context, "record.deleteRecording", () => recorder.deleteRecording());
    recorder.registerCommand(context, "record.undo", () => recorder.undo());

    // We don't lock on playbacks because they are nested commands.
    recorder.registerCommand(context, "record.playRecording", () => recorder.playback(), { noLock: true });
    recorder.registerCommand(context, "record.playRecordingRepeatedly", () => recorder.repeatPlayback(), { noLock: true });
    recorder.registerCommand(context, "record.playRecordingNTimes", () => recorder.nPlayback(), { noLock: true });
    recorder.registerCommand(context, "record.playNamedRecording", () => recorder.playbackNamedRecording(), { noLock: true });
  }

  registerCommand(context: vscode.ExtensionContext, commandName: string, callback: (...args: any[]) => Thenable<any>, optionalProps?: RegisterCommandOptionalProps) {
    context.subscriptions.push(vscode.commands.registerCommand("groog." + commandName,
      optionalProps?.noLock ? (...args: any) => this.execute("groog." + commandName, args, callback) : this.lockWrap("groog." + commandName, (...args: any) => this.execute("groog." + commandName, args, callback), optionalProps?.noTimeout),
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
    this.addRecord(new CommandRecord(command, ...args));
    this.baseCommand = false;
    await callback(...args);
    this.baseCommand = true;
  }

  getRecordBook(): RecordBook | undefined { return this.recordBooks.at(-1)!; }
  forceGetRecordBook(): RecordBook { return this.getRecordBook()!; }
  getOptionalRecordBook(): RecordBook | undefined { return this.recordBooks.at(-1); }

  setRecordBook(newBook: RecordBook) { this.recordBooks[this.recordBooks.length - 1] = newBook; }

  async undo() {
    const recordBook = this.getRecordBook();
    if (!recordBook) {
      vscode.window.showErrorMessage(`No recordings exist yet!`);
      return;
    }
    return recordBook.undo();
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
        message: "This record name already exists",
        severity: vscode.InputBoxValidationSeverity.Error,
      };
    }
  }

  async saveNewRec(recordBook: RecordBook): Promise<void> {
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

    this.saveNewRec(this.forceGetRecordBook());
    this.deactivate();
  }

  async endRecording() {
    if (!this.isActive()) {
      vscode.window.showErrorMessage("Not recording!");
    } else {
      this.deactivate();
    }
  }

  async deleteRecording() {
    if (this.isActive()) {
      vscode.window.showErrorMessage("Still recording!");
      return;
    }

    const input = vscode.window.createQuickPick<vscode.QuickPickItem>();
    input.items = [...this.namedRecordings.keys()]
      .sort((a: string, b: string): number => a.localeCompare(b))
      .map(item => {
        return {
          label: item,
        };
      });
    input.placeholder = "Recording name";
    input.title = "Choose recording to delete";

    const disposables: vscode.Disposable[] = [];
    disposables.push(
      // Dispose of events when leaving the widget.
      input.onDidHide(e => {
        disposables.forEach(d => d.dispose);
      }),
      // When accepting an event, delete the record book
      input.onDidAccept(async (): Promise<any> => {
        for (const item of input.selectedItems) {
          this.namedRecordings.delete(item.label);
        }
        input.dispose();
      }),
    );

    return input.show();
  }

  async playbackNamedRecording() {
    if (this.isActive()) {
      vscode.window.showErrorMessage("Still recording!");
      return;
    }

    // Create items
    const recentItems: RecordBookQuickPickItem[] = this.recordBooks.map((recordBook, idx) => {
      return {
        recordBook: recordBook,
        buttons: [
          new SaveRecentRecordingButton(),
          recordBook.repeatable() ? new RepeatRecordingButton() : undefined,
          new NTimesRecordingButton(),
        ].filter(btn => btn) as vscode.QuickInputButton[],
        label: `${RECENT_RECORDING_PREFIX} ${this.recordBooks.length - 1 - idx}`,
      };
    }).reverse();

    const items: RecordBookQuickPickItem[] = [...this.namedRecordings.entries()]
      .map((a: [string, RecordBook]): RecordBookQuickPickItem => {
        return {
          recordBook: a[1],
          label: a[0],
          buttons: [
            a[1].repeatable() ? new RepeatRecordingButton() : undefined,
            new NTimesRecordingButton(),
          ].filter(btn => btn) as vscode.QuickInputButton[],
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

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
      input.onDidTriggerItemButton(async (event: vscode.QuickPickItemButtonEvent<RecordBookQuickPickItem>): Promise<any> => {
        switch (event.button.constructor) {
          case SaveRecentRecordingButton:
            input.dispose();
            this.saveNewRec(event.item.recordBook);
            break;
          case RepeatRecordingButton:
            input.dispose();
            await event.item.recordBook.repeatedPlayback(this.emacs);
            break;
          case NTimesRecordingButton:
            input.dispose();
            await event.item.recordBook.nPlaybacks(this.emacs);
            break;
          default:
            vscode.window.showErrorMessage(`Unknown item button`);
        }
      }),
      // When accepting an event, run the record book!
      input.onDidAccept(async (): Promise<any> => {
        // IMPORTANT NOTE: input.dispose() ***MUST*** be executed before anything else (for deterministic test execution).
        // No clue why exactly, but if it's done at the end, then test execution doesn't await promises properly.
        input.dispose();
        switch (input.selectedItems.length) {
          case 0:
            vscode.window.showErrorMessage("No named recording selection made");
            break;
          case 1:
            await input.selectedItems[0].recordBook.playback(this.emacs);
            break;
          default:
            vscode.window.showErrorMessage(`Multiple selections made somehow?!`);
            break;
        };
      }),
    );

    return input.show();
  }

  async playbackAction(f: (rb: RecordBook) => Promise<any>): Promise<any> {
    if (this.isActive()) {
      vscode.window.showErrorMessage("Still recording!");
      return;
    }
    const recordBook = this.getOptionalRecordBook();
    if (!recordBook) {
      vscode.window.showErrorMessage(`No recordings exist yet!`);
      return;
    }
    return f(recordBook);
  }

  async repeatPlayback(): Promise<void> {
    return this.playbackAction((rb: RecordBook) => rb.repeatedPlayback(this.emacs));
  }

  async nPlayback(): Promise<void> {
    return this.playbackAction((rb: RecordBook) => rb.nPlaybacks(this.emacs));
  }

  async playback(): Promise<any> {
    return this.playbackAction((rb: RecordBook) => rb.playback(this.emacs));
  }

  async handleActivation() {
    this.recordBooks.push(new RecordBook());
  }
  onRedundantActivate(): void {
    vscode.window.showErrorMessage(`Already recording!`);
  }

  async handleDeactivation() {
    this.forceGetRecordBook().trimAndLock();
    if (this.recordBooks.length > MAX_RECORDINGS) {
      this.recordBooks = this.recordBooks.slice(this.recordBooks.length - MAX_RECORDINGS);
    }
    await vscode.commands.executeCommand("closeFindWidget");
  }

  addRecord(r: Record) {
    if (this.baseCommand && !this.finder?.isActive()) {
      this.forceGetRecordBook().addRecord(r);
    }
  }

  async textHandler(s: string): Promise<boolean> {
    this.addRecord(new TypeRecord(s));
    return true;
  }

  // All these functions are associated with a "groog.*" command so these are
  // already added to the record book via the "type" command handling
  async onKill() { }
  alwaysOnKill: boolean = false;
  async ctrlG() {
    return true;
  }
  async onYank() { }
  alwaysOnYank: boolean = false;
  async onPaste(): Promise<boolean> {
    return true;
  }
  async onEmacsPaste(): Promise<boolean> {
    return true;
  }
  async delHandler(): Promise<boolean> {
    return true;
  }
  async moveHandler(): Promise<boolean> {
    return true;
  }
}

export interface Record {
  playback(emacs: Emacs): Promise<boolean>;

  // undo undoes the record and returns a boolean indicating if the undo operation was successful.
  undo(): Promise<boolean>;

  // eat attempts to eat the next record and returns whether it did or not.
  eat(next: Record): boolean;

  // Whenever a record is eaten, we check if it has become an effectively no-op (in which
  // case it will be removed)
  noop(): boolean;
}

export class TypeRecord implements Record {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  async playback(emacs: Emacs): Promise<boolean> {
    return emacs.typeBonusFeatures(this.text, true).then(() => true);
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
        if (cr.command === `groog.${DeleteCommand.Left}`) {
          // Length will not be zero because it will be popped by the noop check.
          this.text = this.text.slice(0, this.text.length - 1);
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

export class CommandRecord implements Record {
  command: string;
  args: any[];

  constructor(command: string, ...args: any) {
    this.command = command;
    this.args = args;
  }

  async playback(): Promise<boolean> {
    await vscode.commands.executeCommand(this.command, ...this.args);
    return true;
  }

  noop(): boolean {
    return false;
  }

  eat(next: Record): boolean {
    switch (next.constructor) {
      case CommandRecord:
        const cr = <CommandRecord>next;
        return (this.command === `groog.cursorEnd`) && (cr.command === `groog.cursorEnd`);
    }

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
  recordBook: RecordBook;
}

class SaveRecentRecordingButton implements vscode.QuickInputButton {
  readonly iconPath: vscode.ThemeIcon;
  readonly tooltip?: string;
  constructor() {
    this.iconPath = new vscode.ThemeIcon("save");
    this.tooltip = "Save recording as...";
  }
}

class RepeatRecordingButton implements vscode.QuickInputButton {
  readonly iconPath: vscode.ThemeIcon;
  readonly tooltip?: string;
  constructor() {
    // Considered options for this were `sync`, `debug-rerun`, `run-all`
    this.iconPath = new vscode.ThemeIcon("debug-rerun");
    this.tooltip = "Run repeatedly";
  }
}

class NTimesRecordingButton implements vscode.QuickInputButton {
  readonly iconPath: vscode.ThemeIcon;
  readonly tooltip?: string;
  constructor() {
    this.iconPath = new vscode.ThemeIcon("run-all"); // Or maybe `symbol-number` for icon?
    this.tooltip = "Run N times";
  }
}
