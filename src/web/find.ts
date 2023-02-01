import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';

const maxFindCacheSize : number = 100;

interface FindContext {
  findText : string;
  replaceText : string;
}

interface FindWithArgs {
  searchString : string;
  replaceString? : string;
}

class FindContextCache {
  private cache: FindContext[];
  private cacheIdx: number;
  private cursorStack: CursorStack;
  private replaceMode: boolean;
  private findPrevOnType: boolean;

  constructor() {
    this.cache = [];
    this.cacheIdx = 0;
    this.cursorStack = new CursorStack();
    this.replaceMode = false;
    this.findPrevOnType = false;
  }

  public async startNew(findPrevOnType: boolean) : Promise<void> {
    this.cache.push({
      findText: "",
      replaceText: "",
    });
    if (this.cache.length > maxFindCacheSize) {
      this.cache = this.cache.slice(1);
    }
    this.cacheIdx = this.cache.length-1;
    this.findPrevOnType = findPrevOnType;
    await this.findWithArgs();
  }

  public async end(): Promise<void> {
    let lastCtx = this.cache[this.cache.length-1];
    if (lastCtx.findText.length === 0 && lastCtx.replaceText.length === 0) {
      this.cache.pop();
    }
    this.replaceMode = false;
  }

  public async toggleReplaceMode() {
    this.replaceMode = !this.replaceMode;
    await this.findWithArgs();
  }

  private currentContext() : FindContext {
    return this.cache[this.cacheIdx ?? this.cache.length-1];
  }

  public async nextContext(): Promise<void> {
    if (this.cacheIdx >= this.cache.length-1) {
      vscode.window.showInformationMessage("End of find cache");
      return;
    }
    this.cacheIdx++;
    this.cursorStack.clear();
    await this.findWithArgs();
  }

  public async prevContext(): Promise<void> {
    if (this.cacheIdx <= 0) {
      vscode.window.showInformationMessage("No earlier find contexts available");
      return;
    }
    this.cacheIdx--;
    this.cursorStack.clear();
    await this.findWithArgs();
  }

  public async insertText(s: string): Promise<void> {
    let ctx = this.currentContext();
    if (this.replaceMode) {
      ctx.replaceText = ctx.replaceText.concat(s);
    } else {
      ctx.findText = ctx.findText.concat(s);
      this.cursorStack.push();
    }
    await this.findWithArgs();
  }

  public async deleteLeft(): Promise<void> {
    let ctx = this.currentContext();
    if (this.replaceMode) {
      if (ctx.replaceText.length > 0) {
        ctx.replaceText = ctx.replaceText.slice(0, ctx.replaceText.length - 1);
        await this.findWithArgs();
      }
    } else {
      if (ctx.findText.length > 0) {
        ctx.findText = ctx.findText.slice(0, ctx.findText.length - 1);
        this.cursorStack.popAndSet(this.findPrevOnType);
        await this.findWithArgs();
      }
    }
  }

  private async findWithArgs() {
    let ctx : FindContext = this.currentContext();
    let ft : string = ctx.findText;
    if (ft.length === 0) {
      // Plus sign so not annoying when searching in this file.
      ft = "ENTER_" + "TEXT";
    }

    let args : FindWithArgs = {
      "searchString": ft,
    };
    if (this.replaceMode) {
      args = {
        "searchString": ft,
        "replaceString": ctx.replaceText,
      };
    }
    await vscode.commands.executeCommand("editor.actions.findWithArgs", args).then(async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }, async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }
    );

    if (this.findPrevOnType) {
      await cursorToBack();
      await this.prevMatch();
    } else {
      await cursorToFront();
      await this.nextMatch();
    }
  }

  async nextMatch() {
    await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
  }

  async prevMatch() {
    await vscode.commands.executeCommand("editor.action.previousMatchFindAction");
  }
}


export class FindHandler extends TypeHandler {
  whenContext: string = "find";
  cache : FindContextCache;
  findPrevOnType : boolean;

  constructor(cm: ColorMode) {
    super(cm, ModeColor.find);
    this.cache = new FindContextCache();
    this.findPrevOnType = false;
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', async () => {
      if (this.isActive()) {
        await this.cache.nextMatch();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'reverseFind', async () => {
      if (this.isActive()) {
        await this.cache.prevMatch();
      } else {
        this.findPrevOnType = true;
        await this.activate();
      }
    });

    recorder.registerCommand(context, 'find.toggleReplaceMode', async () => {
      if (!this.isActive()) {
        return;
      }
      await this.cache.toggleReplaceMode();
    });

    // Goes to previous find context
    recorder.registerCommand(context, 'find.previous', async () => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.previous can only be executed in find mode");
      } else {
        await this.cache.prevContext();
      }
    });
    // Goes to next find context
    recorder.registerCommand(context, 'find.next', async () => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.next can only be executed in find mode");
      } else {
        await this.cache.nextContext();
      }
    });

    recorder.registerCommand(context, 'focusNextEditor', async () => {
      await this.deactivateCommands();
      await vscode.commands.executeCommand("workbench.action.focusNextGroup");
    });
    recorder.registerCommand(context, 'focusPreviousEditor', async () => {
      await this.deactivateCommands();
      await vscode.commands.executeCommand("workbench.action.focusPreviousGroup");
    });
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await this.deactivate();
    });
  }

  async handleActivation() {
    await this.cache.startNew(this.findPrevOnType);
  }

  async deactivateCommands() {
    await vscode.commands.executeCommand("cancelSelection");
    await vscode.commands.executeCommand("closeFindWidget");
  }

  async handleDeactivation() {
    await this.cache.end();
    await this.deactivateCommands();
    this.findPrevOnType = false;
  }

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
    await this.cache.insertText(s);
    return false;
  }

  async moveHandler(cmd: CursorMove): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    switch (s) {
      case DeleteCommand.left:
        await this.cache.deleteLeft();
        break;
      default:
        vscode.window.showInformationMessage("Unsupported find command: " + s);
    }
    return false;
  }

  // TODO: do something like error message or deactivate
  async onYank(s: string | undefined) { }
  alwaysOnYank: boolean = false;
  async onKill(s: string | undefined) { }
  alwaysOnKill: boolean = false;
}

class CursorStack {
  selections: vscode.Selection[];

  constructor() {
    this.selections = [];
  }

  push() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Couldn't find active editor");
      this.selections.push(new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)));
      return;
    }
    this.selections.push(editor.selection);
  }

  popAndSet(rev: boolean) {
    let p = this.selections.pop();
    if (!p) {
      // No longer error here since we can run out of cursor positions if
      // we start a search with a non-empty findText.
      return;
    }
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Undefined editor");
      return;
    }
    // https://github.com/microsoft/vscode/issues/111#issuecomment-157998910
    if (rev) {
      editor.selection = new vscode.Selection(p.end, p.end);
    } else {
      editor.selection = new vscode.Selection(p.start, p.start);
    }

  }

  clear() {
    this.selections = [];
  }
}

export async function cursorToFront() {
  // Move cursor to beginning of selection
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const startPos = editor.selection.start;
    editor.selection = new vscode.Selection(startPos, startPos);
  }
}

export async function cursorToBack() {
  // Move cursor to end of selection
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    // If at the end of the word, then cursor is considered to be "in" the match still
    // so when previous action is executed, we move to the previous selection rather
    // than staying at the current one.
    const endPos = editor.selection.end.translate(0, 1);
    editor.selection = new vscode.Selection(endPos, endPos);
  }
}
