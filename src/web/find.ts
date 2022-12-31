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

class FindContextCache {
  cache: FindContext[];
  cacheIdx: number;
  cursorStack: CursorStack;

  constructor() {
    this.cache = [];
    this.cacheIdx = 0;
    this.cursorStack = new CursorStack();
  }

  async startNew() : Promise<void> {
    this.cache.push({
      findText: "",
      replaceText: "",
    });
    if (this.cache.length > maxFindCacheSize) {
      this.cache = this.cache.slice(1);
    }
    this.cacheIdx = this.cache.length-1;
    await this.findWithArgs();
  }

  async end(): Promise<void> {
    let lastCtx = this.cache[this.cache.length-1];
    if (lastCtx.findText.length === 0 && lastCtx.replaceText.length === 0) {
      this.cache.pop();
    }
  }

  currentContext() : FindContext {
    return this.cache[this.cacheIdx ?? this.cache.length-1];
  }

  async nextContext(): Promise<void> {
    if (this.cacheIdx >= this.cache.length-1) {
      vscode.window.showInformationMessage("End of find cache");
      return;
    }
    this.cacheIdx++;
    this.cursorStack.clear();
    await this.findWithArgs();
  }

  async prevContext(): Promise<void> {
    if (this.cacheIdx <= 0) {
      vscode.window.showInformationMessage("No earlier find contexts available");
      return;
    }
    this.cacheIdx--;
    this.cursorStack.clear();
    await this.findWithArgs();
  }

  async insertText(s: string, replaceMode: boolean): Promise<void> {
    let ctx = this.currentContext();
    if (replaceMode) {
      ctx.replaceText = ctx.replaceText.concat(s);
    } else {
      ctx.findText = ctx.findText.concat(s);
      this.cursorStack.push();
    }
    await this.findWithArgs();
  }

  async deleteLeft(replaceMode: boolean): Promise<void> {
    let ctx = this.currentContext();
    if (replaceMode) {
      if (ctx.replaceText.length > 0) {
        ctx.replaceText = ctx.replaceText.slice(0, ctx.replaceText.length - 1);
        await this.findWithArgs();
      }
    } else {
      if (ctx.findText.length > 0) {
        ctx.findText = ctx.findText.slice(0, ctx.findText.length - 1);
        this.cursorStack.popAndSet();
        await this.findWithArgs();
      }
    }
  }

  async findWithArgs() {
    let ctx : FindContext = this.currentContext();
    let ft : string = ctx.findText;
    if (ft.length === 0) {
      // Plus sign so not annoying when searching in this file.
      ft = "ENTER_" + "TEXT";
    }
    await vscode.commands.executeCommand("editor.actions.findWithArgs", { "searchString": ft, "replaceString": ctx.replaceText, }).then(async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }, async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }
    );
    await cursorToFront();
    await this.nextMatch();
  }

  async nextMatch() {
    await vscode.commands.executeCommand("editor.action.nextMatchFindAction");
  }

  async prevMatch() {
    await vscode.commands.executeCommand("editor.action.previousMatchFindAction");
  }
}


export class FindHandler extends TypeHandler {
  replaceMode: boolean;
  whenContext: string = "find";
  cache : FindContextCache;

  constructor(cm: ColorMode) {
    super(cm, ModeColor.find);
    this.replaceMode = false;
    this.cache = new FindContextCache();
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', async () => {
      if (this.isActive()) {
        await this.cache.nextMatch();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'find.toggleReplaceMode', async () => {
      if (!this.isActive()) {
        return;
      }
      this.replaceMode = !this.replaceMode;
    });
    recorder.registerCommand(context, 'reverseFind', async () => {
      if (this.isActive()) {
        await this.cache.prevMatch();
      } else {
        await this.activate();
      }
    });
    recorder.registerCommand(context, 'find.previous', async () => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.previous can only be executed in find mode");
      } else {
        this.cache.prevContext();
      }
    });
    recorder.registerCommand(context, 'find.next', async () => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.next can only be executed in find mode");
      } else {
        this.cache.nextContext();
      }
    });
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await this.deactivate();
    });
  }

  async handleActivation() {
    await this.cache.startNew();
  }

  async handleDeactivation() {
    this.replaceMode = false;
    this.cache.end();
    await vscode.commands.executeCommand("cancelSelection");
    await vscode.commands.executeCommand("closeFindWidget");
  }

  async ctrlG() {
    await this.deactivate();
  }

  async textHandler(s: string): Promise<boolean> {
    // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
    this.cache.insertText(s, this.replaceMode);
    return false;
  }

  async moveHandler(cmd: CursorMove): Promise<boolean> {
    await this.deactivate();
    return true;
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    switch (s) {
      case DeleteCommand.left:
        this.cache.deleteLeft(this.replaceMode);
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
  selections: vscode.Position[];

  constructor() {
    this.selections = [];
  }

  push() {
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Couldn't find active editor");
      this.selections.push(new vscode.Position(0, 0));
      return;
    }
    this.selections.push(new vscode.Position(editor.selection.start.line, editor.selection.start.character));
  }

  popAndSet() {
    let p = this.selections.pop();
    if (!p) {
      // No longer error here since we can run out of cursor positions if
      // we start a search with a non-empty findText.
      // vscode.window.showErrorMessage("Ran out of cursor positions");
      return;
    }
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Undefined editor");
      return;
    }
    // https://github.com/microsoft/vscode/issues/111#issuecomment-157998910
    editor.selection = new vscode.Selection(p, p);
  }

  clear() {
    this.selections = [];
  }
}

export async function cursorToFront() {
  // Move cursor to beginning of selection
  let editor = vscode.window.activeTextEditor;
  if (editor) {
    let startPos = editor.selection.start;
    editor.selection = new vscode.Selection(startPos, startPos);
  }
}
