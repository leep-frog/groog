import * as vscode from 'vscode';
import { handleDeleteCharacter, handleTypedCharacter } from './character-functions';
import { ColorMode } from './color_mode';
import { FindHandler } from './find';
import { getPrefixText, Registerable, TypeHandler } from './handler';
import { CtrlGCommand, CursorMove, DeleteCommand, setGroogContext } from './interfaces';
import { TypoFixer } from './internal-typos';
import { MarkHandler } from './mark';
import { miscCommands, miscTestReset, multiCommand } from './misc-command';
import { Recorder } from './record';
import { Scripts } from './scripts';
import { Settings } from './settings';
import { stubs, TestResetArgs } from './stubs';
import { TerminalFindHandler } from './terminal-find';


export class TruncatedOutputChannel {

  private outputChannel: vscode.OutputChannel;
  private logs: string[];
  enabled: boolean;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.logs = [];
    this.enabled = true;
  }

  log(message: string, reset?: boolean, force?: boolean) {
    if (!this.enabled && !force) {
      return;
    }

    message = `[${new Date()}]: ${message}`;

    if (reset) {
      this.outputChannel.clear();
      this.logs = [];
    }

    this.logs.push(message);
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(900);
      this.outputChannel.replace(this.logs.join("\n"));
    } else {
      this.outputChannel.appendLine(message);
    }
  }
}

export class GlobalBoolTracker {
  private stateTracker: GlobalStateTracker<boolean>;
  private value: boolean;
  private toggleActions: Map<boolean, () => Promise<any>>;

  constructor(key: string, activateFunc: () => Promise<any>, deactivateFunc: () => Promise<any>) {
    this.stateTracker = new GlobalStateTracker<boolean>(key);
    this.value = false; // This is actually set in initialize()
    this.toggleActions = new Map<boolean, () => Promise<any>>([
      [true, activateFunc],
      [false, deactivateFunc],
    ]);
  }

  async initialize(context: vscode.ExtensionContext) {
    this.value = !!this.stateTracker.get(context);
    return this.toggleActions.get(this.value)!();
  }

  async toggle(context: vscode.ExtensionContext) {
    this.value = !this.value;
    return this.stateTracker.update(context, this.value).then(this.toggleActions.get(this.value)!);
  }

  get(): boolean {
    return this.value;
  }
}

export class GlobalStateTracker<T> {
  private key: string;

  constructor(key: string) {
    this.key = `groog.keys.${key}`;
  }

  get(context: vscode.ExtensionContext): T | undefined {
    return context.globalState.get<T>(this.key);
  }

  async update(context: vscode.ExtensionContext, t: T) {
    await context.globalState.update(this.key, t);
  }
}

export class Emacs {
  qmkTracker: GlobalBoolTracker;
  recorder: Recorder;
  typeHandlers: TypeHandler[];
  cm: ColorMode;
  typoFixer: TypoFixer;
  scripts: Scripts;
  lastVisitedFile?: vscode.Uri;
  outputChannel: TruncatedOutputChannel;

  constructor() {
    this.cm = new ColorMode();
    this.outputChannel = new TruncatedOutputChannel(vscode.window.createOutputChannel("groogle"));
    this.qmkTracker = new GlobalBoolTracker("qmkState", async () => {
      return setGroogContext('qmk', true).then(() => {
        // We don't want to wait on the message, otherwise, we are locked until the message is cleared
        vscode.window.showInformationMessage(`QMK keyboard mode activated`);
      });
    }, async () => {
      return setGroogContext('qmk', false).then(() => {
        // We don't want to wait on the message, otherwise, we are locked until the message is cleared
        vscode.window.showInformationMessage(`Basic keyboard mode activated`);
      });
    });
    this.recorder = new Recorder(this.cm, this);
    this.typoFixer = new TypoFixer();
    const finder = new FindHandler(this.cm, this.recorder);
    this.recorder.setFinder(finder);
    this.typeHandlers = [
      finder,
      new MarkHandler(this.cm, this),
      new TerminalFindHandler(this.cm),
      this.recorder,
    ];
    this.scripts = new Scripts();

    this.lastVisitedFile = vscode.window.activeTextEditor?.document.uri;
  }

  private static registerables(): Registerable[] {
    return [
      new Settings(),
    ];
  }

  private checkExtensionDependency(extensionId: string) {
    if (!!vscode.extensions.getExtension(extensionId)) {
      return;
    }

    // Otherwise, suggest installing to the user
    vscode.window.showWarningMessage(
      `The extension ${extensionId} is not installed`,
      'Install',
      'Dismiss',
    ).then(selection => {
      if (selection === 'Install') {
        return vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId).then(
          () => vscode.window.showInformationMessage(`Extension ${extensionId} was successfully installed!`),
          (err) => vscode.window.showErrorMessage(`Extension ${extensionId} failed to install: ${err}`),
        );
      }
    });
  }

  private checkDependencies() {
    const allDependencies = [
      "groogle.faves",
      "groogle.very-import-ant",
      "ryanluker.vscode-coverage-gutters"

      // These are ui extensions, so can't really check for them on the remote host
      // "groogle.what-the-beep",
      // "groogle.termin-all-or-nothing",
    ];

    for (const extensionId of allDependencies) {
      this.checkExtensionDependency(extensionId);
    }
  }

  register(context: vscode.ExtensionContext) {

    this.checkDependencies();

    for (var move of Object.values(CursorMove)) {
      const m = move;
      this.recorder.registerCommand(context, move, (...args: any[]) => this.move(m, ...args));
    }
    for (var dc of Object.values(DeleteCommand)) {
      const d = dc;
      this.recorder.registerCommand(context, d, () => this.delCommand(d));
    }

    this.typoFixer.register(context);

    context.subscriptions.push(vscode.commands.registerCommand('groog.type', this.recorder.lockWrap('groog.type', (arg: TypeArg) => this.type(arg))));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => {
      if (e && isFileUri(e.document.uri) && (!this.lastVisitedFile || (this.lastVisitedFile.toString() !== e.document.uri.toString()))) {
        this.lastVisitedFile = e.document.uri;
      }
    }));

    this.recorder.registerCommand(context, 'jump', (jd: JumpDist | undefined) => this.jump(jd || defaultJumpDist));
    this.recorder.registerCommand(context, 'fall', (jd: JumpDist | undefined) => this.fall(jd || defaultJumpDist));
    this.recorder.registerCommand(context, 'format', () => this.format());

    this.recorder.registerCommand(context, 'toggleQMK', () => this.qmkTracker.toggle(context));
    this.recorder.registerCommand(context, 'yank', () => this.yank(true));
    this.recorder.registerCommand(context, 'tug', () => this.yank(false));
    this.recorder.registerCommand(context, 'kill', () => this.kill(true));
    this.recorder.registerCommand(context, 'maim', () => this.kill(false));
    this.recorder.registerCommand(context, 'ctrlG', () => this.ctrlG());

    // Make an explicit command so it is visible in "alt+x".
    this.recorder.registerCommand(context, 'renameFile', () => {
      return multiCommand({
        sequence: [
          { command: "workbench.action.focusSideBar" },
          { command: "renameFile" },
        ],
      });
    });

    this.recorder.registerCommand(context, 'indentToPreviousLine', () => this.indentToPrevLine(-1));
    this.recorder.registerCommand(context, 'indentToNextLine', () => this.indentToPrevLine(1));

    this.recorder.registerCommand(context, 'undo', () => vscode.commands.executeCommand("undo"));
    this.recorder.registerCommand(context, 'redo', () => vscode.commands.executeCommand("redo"));

    for (var th of this.typeHandlers) {
      th.register(context, this.recorder);
    }

    for (var r of Emacs.registerables()) {
      r.register(context, this.recorder);
    }

    this.scripts.register(context, this.recorder);

    [
      ...miscCommands,
    ].forEach(mc => this.recorder.registerCommand(context, mc.name, (args) => mc.f(this, args), { noLock: mc.noLock }));

    this.recorder.registerCommand(context, 'test.reset', async (trArgs: TestResetArgs) => {
      if (process.env.TEST_MODE) {
        this.lastVisitedFile = undefined;
        for (const h of this.typeHandlers) {
          await h.testReset();
        }
        miscTestReset();
        this.typoFixer.reload(true);
        stubs.configureForTest(trArgs.execStubs || [], trArgs.wantSendTerminalCommandArgs || []);
      } else {
        vscode.window.showErrorMessage(`Cannot run test.reset outside of test mode!`);
      }
    });

    this.recorder.registerCommand(context, 'test.verify', async () => {
      if (process.env.TEST_MODE) {
        stubs.verify();
      } else {
        vscode.window.showErrorMessage(`Cannot run test.verify outside of test mode!`);
      }
    });

    // After all commands have been registered, check persistent data for qmk setting.
    this.qmkTracker.initialize(context);
  }

  async runHandlers(thCallback: (th: TypeHandler) => Thenable<boolean>, applyCallback: () => Thenable<any>): Promise<void> {
    let chain: Promise<boolean> = Promise.resolve().then(() => true);
    for (const th of this.typeHandlers) {
      if (th.isActive()) {
        chain = chain.then((apply: boolean) => apply ? thCallback(th) : thCallback(th).then(() => false));
      }
    }
    return chain.then((apply: boolean) => apply ? applyCallback() : false).catch((reason: any) => { vscode.window.showErrorMessage(`Failed to apply callbacks: ${reason}`); });
  }

  async type(arg: TypeArg): Promise<void> {
    const s = arg.text;
    return this.runHandlers(
      async (th: TypeHandler): Promise<boolean> => th.textHandler(s),
      async (): Promise<void> => this.typeBonusFeatures(s),
    );
  }

  public async typeBonusFeatures(s: string, skipBonusFeatures?: boolean): Promise<void> {

    // We don't want to execute typo fixes or auto-close characters in record mode
    // because it can lead to unexpected behavior (e.g. if we want to add ` next` to each line, and our text is:
    // sa
    // se
    // Then, running the recording on each line would produce the following (due to se->showErrorMessage mapping):
    // sa next
    // vscode.window.showErrorMessage(`next`);
    //
    // Similarly, type-over might lead to unexpedted behavior if some lines have nested parens and others don't.
    if (!this.recorder.isActive() && !skipBonusFeatures) {

      // Check for a dictionary replacement
      // This handles replacements like se -> vscode.window.showErrorMessage(``);
      if ((await this.typoFixer.check(s))) {
        return;
      }

      // This handles auto-open and auto-close characters (like `{}`)
      if (await handleTypedCharacter(s)) {
        return;
      }
    }

    return await vscode.commands.executeCommand("default:type", { text: s });
  }


  async delCommand(d: DeleteCommand): Promise<void> {
    return this.runHandlers(
      async (th: TypeHandler): Promise<boolean> => th.delHandler(d),
      async () => handleDeleteCharacter(d).then(b => b ? false : vscode.commands.executeCommand(d)),
    );
  }

  async yank(deleteSelection: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let range = editor.selection;

    let maybeText: string;
    let prefixText: string;
    if (!editor.selection.isEmpty) {
      maybeText = editor.document.getText(range);
      prefixText = getPrefixText(editor, range);
    } else {
      const lineNumber = range.active.line;
      const lineRange = editor.document.lineAt(lineNumber).range;
      const lineText = editor.document.getText(lineRange);

      const [leftText, rightText] = [lineText.slice(0, range.active.character), lineText.slice(range.active.character)];

      const leftMatch = /([a-zA-Z0-9_]*)$/.exec(leftText)![1];
      const rightMatch = /^([a-zA-Z0-9_]*)/.exec(rightText)![1];

      maybeText = leftMatch + rightMatch;
      prefixText = "";

      range = new vscode.Selection(
        new vscode.Position(lineNumber, range.start.character - leftMatch.length),
        new vscode.Position(lineNumber, range.start.character + rightMatch.length),
      );
    }

    const indentation = editor.options.insertSpaces ? ' '.repeat(editor.options.indentSize as number) : '\t';

    for (var th of this.typeHandlers) {
      if (th.isActive() || th.alwaysOnYank) {
        await th.onYank(prefixText, maybeText, indentation);
      }
    }

    if (range.active.compareTo(range.anchor)) {
      if (deleteSelection) {
        await vscode.window.activeTextEditor?.edit(editBuilder => {
          editBuilder.delete(range);
        });
      } else {
        editor.selection = new vscode.Selection(editor.selection.active, editor.selection.active);
      }
    }
  }

  async ctrlG() {
    return this.runHandlers(
      async (th: TypeHandler): Promise<boolean> => th.ctrlG(),
      async () => {
        for (var cmd of Object.values(CtrlGCommand)) {
          await vscode.commands.executeCommand(cmd);
        }
      },
    );
  }

  async kill(deleteSelection: boolean) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let startPos = editor.selection.active;
    let endPos = editor.document.lineAt(startPos.line).range.end;
    let range = new vscode.Range(startPos, endPos);
    let text = editor.document.getText(range);
    // Do nothing here so that "Undo" command doesn't undo nothing.
    if (text.length === 0) {
      return;
    }
    // No longer pull next line because we would just do that with ctrl+d
    /*if (text.trim().length === 0) {
      range = new vscode.Range(startPos, new vscode.Position(startPos.line + 1, 0));
    }*/
    for (var th of this.typeHandlers) {
      if (th.isActive() || await th.alwaysOnKill) {
        th.onKill(text);
      }
    }
    if (deleteSelection) {
      await vscode.window.activeTextEditor?.edit(editBuilder => {
        editBuilder.delete(range);
      });
    }
  }

  async indentToPrevLine(offset: number) {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Get line info
    let curLine = editor.selection.active.line;
    let otherLine = curLine + offset;
    if (otherLine < 0 || otherLine >= editor.document.lineCount) {
      return;
    }
    let curWSRange = new vscode.Range(
      new vscode.Position(curLine, 0),
      new vscode.Position(curLine, editor.document.lineAt(curLine).firstNonWhitespaceCharacterIndex),
    );
    let otherLineRange = editor.document.lineAt(otherLine).range;
    let otherLineText = editor.document.getText(otherLineRange);

    // Get the match
    const r = /^\s*/;
    const match = r.exec(otherLineText);
    if (match === null) {
      vscode.window.showInformationMessage("No match found.");
      return;
    }

    // Replace text.
    await vscode.window.activeTextEditor?.edit(editBuilder => {
      editBuilder.replace(curWSRange, match[0]);
    });
  }

  // C-l
  async jump(jd: JumpDist) {
    await this.move(CursorMove.Move, { "to": "up", "by": "line", "value": jd.lines });
  }

  // C-v
  async fall(jd: JumpDist) {
    await this.move(CursorMove.Move, { "to": "down", "by": "line", "value": jd.lines });
  }

  async move(vsCommand: CursorMove, ...rest: any[]): Promise<void> {
    return this.runHandlers(
      async (th: TypeHandler): Promise<boolean> => {
        return th.moveHandler(vsCommand, ...rest);
      },
      async (): Promise<void> => vscode.commands.executeCommand(vsCommand, ...rest),
    );
  }

  async format() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    if (editor.selection.isEmpty) {
      await vscode.commands.executeCommand("editor.action.formatDocument");
      await vscode.commands.executeCommand("editor.action.trimTrailingWhitespace");
      await vscode.commands.executeCommand("editor.action.organizeImports");
    } else {
      await vscode.commands.executeCommand("editor.action.formatSelection");
    }
  }
}

interface TypeArg {
  text: string;
}

interface JumpDist {
  lines: number;
}

const defaultJumpDist: JumpDist = {
  lines: 10,
};

function isFileUri(uri: vscode.Uri): boolean {
  return uri.scheme === "file";
}

export function tabbify(s: string): string {
  return s.replace(/\t/g, '\\t');
}
