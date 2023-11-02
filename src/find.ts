import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';
import { Emacs } from './emacs';

const maxFindCacheSize : number = 100;

interface FindContext {
  modified : boolean;
  findText : string;
  replaceText : string;
}

interface FindWithArgs {
  searchString : string;
  replaceString? : string;
  // Intellisense recommendations are wrong.
  // See: https://github.com/microsoft/vscode/issues/138365
  isRegex: boolean;
  matchWholeWord: boolean;
  isCaseSensitive: boolean;
}

class FindContextCache {
  private cache: FindContext[];
  private cacheIdx: number;
  private cursorStack: CursorStack;
  private replaceMode: boolean;
  private findPrevOnType: boolean;
  private regexToggle: boolean;
  private caseToggle: boolean;
  private wholeWordToggle: boolean;

  constructor() {
    this.cache = [];
    this.cacheIdx = 0;
    this.cursorStack = new CursorStack();
    this.replaceMode = false;
    this.findPrevOnType = false;
    this.regexToggle = false;
    this.caseToggle = false;
    this.wholeWordToggle = false;
  }

  public toggleRegex() {
    this.regexToggle = !this.regexToggle;
  }

  public toggleCase() {
    this.caseToggle = !this.caseToggle;
  }

  public toggleWholeWord() {
    this.wholeWordToggle = !this.wholeWordToggle;
  }

  public async startNew(findPrevOnType: boolean, disallowPreviousContext: boolean, initText?: string) : Promise<void> {
    this.cursorStack.clear();
    this.cache.push({
      modified: !!initText,
      findText: initText || "",
      replaceText: "",
    });
    if (this.cache.length > maxFindCacheSize) {
      this.cache = this.cache.slice(1);
    }
    this.cacheIdx = this.cache.length-1;
    this.findPrevOnType = findPrevOnType;
    await this.findWithArgs(disallowPreviousContext);
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
    ctx.modified = true;
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
        ctx.modified = true;
        ctx.replaceText = ctx.replaceText.slice(0, ctx.replaceText.length - 1);
        await this.findWithArgs();
      }
    } else {
      if (ctx.findText.length > 0) {
        ctx.modified = true;
        ctx.findText = ctx.findText.slice(0, ctx.findText.length - 1);
        this.cursorStack.popAndSet(this.findPrevOnType);
        await this.findWithArgs();
      }
    }
  }

  private async findWithArgs(disallowPreviousContext?: boolean) {
    let ctx : FindContext = this.currentContext();
    let ft : string = ctx.findText;
    if (ft.length === 0) {
      // Plus sign so not annoying when searching in this file.
      ft = "ENTER_" + "TEXT";
    }

    let args : FindWithArgs = {
      searchString: ft,
      isRegex: this.regexToggle,
      matchWholeWord: this.wholeWordToggle,
      isCaseSensitive: this.caseToggle,
    };
    if (this.replaceMode) {
      args.replaceString = ctx.replaceText;
    }
    await vscode.commands.executeCommand("editor.actions.findWithArgs", args).then(async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    }, async () => {
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    });

    if (this.findPrevOnType) {
      // Finding previous is tricky because sometimes if inserting two characters in
      // quick succession, then the selection.end character isn't updated in the second
      // character's execution, causing weird behavior here. Additionally, if adding
      // a '*' character in a regex, then the end cursor will be in the match text,
      // so we will jump to the previous match even though the current match might
      // still be valid. So, we do the following:
      // - Move cursor to the front
      // - Run next match
      // - See if the cursor position changed.
      //   - If it did, then the current selection no longer matches, so find previous one
      //   - Otherwise, it matches, so nothing else required.
      const prevSel = (vscode.window.activeTextEditor?.selection);
      const prevRange = (vscode.window.activeTextEditor?.visibleRanges);
      await cursorToFront();
      await this.nextMatch(!!disallowPreviousContext);
      if (prevSel && vscode.window.activeTextEditor && !prevSel.start.isEqual(vscode.window.activeTextEditor.selection.start)) {
        await this.prevMatch();
      }

      // Finally, check if we didn't need to move the screen
      if (prevRange && vscode.window.activeTextEditor) {
        if (this.rangesContains(prevRange, vscode.window.activeTextEditor.selection)) {
          vscode.window.activeTextEditor.revealRange(prevRange[0]);
        }
      }
    } else {
      await cursorToFront();
      await this.nextMatch(!!disallowPreviousContext);
    }
  }

  private rangesContains(ranges: readonly vscode.Range[], selection: vscode.Selection) : boolean {
    return ranges.reduce((prev: boolean, r: vscode.Range) => prev || r.contains(selection), false);
  }

  /*private manualCheck(queryText: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    let docText = ""; //editor.document.getText()

    if (this.caseToggle) {
      queryText = queryText.toLowerCase();
      docText = docText.toLowerCase();
    }

    let matchesFirst = false;
    if (this.regexToggle) {
      let r = new RegExp(queryText);
      if (this.wholeWordToggle) {
        r = new RegExp(`^${queryText}\b`);
      }
    } else {
      if (this.wholeWordToggle) {

      }
    }
  }*/

  async nextMatch(disallowPreviousContext: boolean) {
    // Most recent one will be empty
    const prevCache = this.cache.at(-2);
    const curCache = this.cache.at(-1);
    if (curCache && prevCache && !disallowPreviousContext && !curCache.modified) {
      this.cache.pop();
      this.cacheIdx--;
      this.findWithArgs();
    } else {
      return vscode.commands.executeCommand("editor.action.nextMatchFindAction");
    }
  }

  async prevMatch() {
    await vscode.commands.executeCommand("editor.action.previousMatchFindAction");
  }
}


export class FindHandler extends TypeHandler {
  whenContext: string = "find";
  cache : FindContextCache;
  // If true, go to the previous match when typing
  findPrevOnType : boolean;
  // If true, we have a simpler find interaction (specifically, don't
  // findWithArgs on every type).
  simpleMode: boolean;

  constructor(cm: ColorMode) {
    super(cm, ModeColor.find);
    this.cache = new FindContextCache();
    this.findPrevOnType = false;
    // TODO: Set this in a setting (see ctrl+x ctrl+k keybinding for keyboard mode change as example)
    this.simpleMode = false;
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    recorder.registerCommand(context, 'find', () => {
      if (this.isActive()) {
        return this.cache.nextMatch(false);
      }
      return this.activate();
    });
    recorder.registerCommand(context, 'reverseFind', () => {
      if (this.isActive()) {
        return this.cache.prevMatch();
      }
      this.findPrevOnType = true;
      return this.activate();
    });

    recorder.registerCommand(context, 'find.toggleReplaceMode', async (): Promise<void> => {
      if (!this.isActive()) {
        return;
      }
      return this.cache.toggleReplaceMode();
    });

    // Goes to previous find context
    recorder.registerCommand(context, 'find.previous', async (): Promise<void> => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.previous can only be executed in find mode");
        return;
      }
      return this.cache.prevContext();
    });
    // Goes to next find context
    recorder.registerCommand(context, 'find.next', async () => {
      if (!this.isActive()) {
        vscode.window.showInformationMessage("groog.find.next can only be executed in find mode");
        return;
      }
      return this.cache.nextContext();
    });

    recorder.registerCommand(context, 'focusNextEditor', async () => {
      return this.deactivateCommands().then(() => vscode.commands.executeCommand("workbench.action.focusNextGroup"));
    });
    recorder.registerCommand(context, 'focusPreviousEditor', async () => {
      return this.deactivateCommands().then(() => vscode.commands.executeCommand("workbench.action.focusPreviousGroup"));
    });
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async () => {
      await this.deactivate();
    }));

    recorder.registerCommand(context, 'find.toggleSimpleMode', async () => {
      this.simpleMode = !this.simpleMode;
      if (this.simpleMode) {
        vscode.window.showInformationMessage(`Activated Find Simple Mode`);
      } else {
        vscode.window.showInformationMessage(`Deactivated Find Simple Mode`);
      }
    });

    recorder.registerCommand(context, 'find.toggleRegex', () => {
      this.cache.toggleRegex();
      return vscode.commands.executeCommand("toggleSearchEditorRegex");
    });
    recorder.registerCommand(context, 'find.toggleCaseSensitive', () => {
      this.cache.toggleCase();
      return vscode.commands.executeCommand("toggleSearchEditorCaseSensitive");
    });
    recorder.registerCommand(context, 'find.toggleWholeWord', () => {
      this.cache.toggleWholeWord();
      return vscode.commands.executeCommand("toggleSearchEditorWholeWord");
    });
  }

  async handleActivation() {
    if (this.simpleMode) {
      const searchQuery = await vscode.window.showInputBox({
        placeHolder: "Search query",
        prompt: "Search text",
      });
      await this.cache.startNew(this.findPrevOnType, false, searchQuery);
    } else {
      await this.cache.startNew(this.findPrevOnType, true);
    }

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
    return this.cache.insertText(s).then(() => false);
  }

  async moveHandler(cmd: CursorMove): Promise<boolean> {
    return this.deactivate().then(() => true);
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    if (s === DeleteCommand.left) {
      return this.cache.deleteLeft().then(() => false);
    }
    vscode.window.showInformationMessage("Unsupported find command: " + s);
    return false;
  }

  // TODO: do something like error message or deactivate
  async onYank() { }
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
