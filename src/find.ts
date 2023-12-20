import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand } from './interfaces';
import { Recorder } from './record';
import { Emacs, GlobalBoolTracker, GlobalStateTracker } from './emacs';
import { Glob } from 'glob';
import { match } from 'assert';

// TODO: decorate matched position.

const decorationType = vscode.window.createTextEditorDecorationType({
  overviewRulerColor: "yellow",
  border: '1px solid yellow',
});

// This import was causing problems in `npm test`, so I just copied the function from: https://www.npmjs.com/package/escape-string-regexp?activeTab=code
// import escapeStringRegexp from 'escape-string-regexp';
function escapeStringRegexp(s: string) {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return s
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    .replace(/-/g, '\\x2d');
}

// _sorted because the type-wrapped functions below should be used
const _sorted = require('sorted-array-functions');
// This just type wraps sorted.gte (since sorted.gte is in javascript)
function sortedGTE<T>(list: T[], value: T, cmp?: (a: T, b: T) => number) : number {
  return _sorted.gte(list, value, cmp);
}


const maxFindCacheSize : number = 100;

interface FindContext {
  modified : boolean;
  findText : string;
  replaceText : string;
}

interface DocumentMatchProps {
  queryText: string;
  caseInsensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
}

export class Document {
  documentText: string;
  caseInsensitiveDocumentText: string;

  // The indices of all newline characters;
  newlineIndices: number[];

  constructor(documentText: string) {
    this.documentText = documentText;
    this.caseInsensitiveDocumentText = documentText.toLowerCase();
    this.newlineIndices = []; // TODO;
    for (let i = 0; i < this.documentText.length; i++) {
      if (this.documentText.charAt(i) === "\n") {
        this.newlineIndices.push(i);
      }
    }
    this.newlineIndices.push(this.documentText.length);
  }

  public matches(props: DocumentMatchProps): vscode.Range[] {
    if (props.queryText.length === 0) {
      return [];
    }

    const text = props.caseInsensitive ? this.caseInsensitiveDocumentText : this.documentText;

    if (props.caseInsensitive) {
      props.queryText = props.queryText.toLowerCase();
    }
    // "g" is the global flag which is required here.
    const rgx = new RegExp(props.regex ? props.queryText : escapeStringRegexp(props.queryText), "g");

    const matches = Array.from(text.matchAll(rgx));
    return matches.map(m => {
      const startIndex = m.index!;
      const endIndex = startIndex + m[0].length;
      return new vscode.Range(
        this.posFromIndex(startIndex),
        this.posFromIndex(endIndex),
      );
    });
  }

  private posFromIndex(index: number): vscode.Position {
    const line = sortedGTE(this.newlineIndices, index);
    const lineStartIndex = line === 0 ? 0 : this.newlineIndices[line-1] + 1;
    const char = index - lineStartIndex;
    return new vscode.Position(line, char);
  }
}

interface RefreshMatchesProps extends DocumentMatchProps {
  prevMatchOnChange: boolean;
}

class MatchTracker {
  private matches: vscode.Range[];
  private matchIdx?: number;
  private editor?: vscode.TextEditor;
  private lastCursorPos?: vscode.Position;

  constructor() {
    this.matches = [];
  }

  public setNewEditor(editor: vscode.TextEditor) {
    this.editor = editor;
    this.lastCursorPos = editor.selection.start;
  }

  public setMatchIndex(idx: number) {
    if (idx < 0 || idx >= this.matches.length) {
      return;
    }
    this.matchIdx = idx;
  }

  public getMatch() : vscode.Range | undefined {
    return this.matchIdx === undefined ? undefined : this.matches[this.matchIdx];
  }

  public getMatchIndex() : number | undefined {
    return this.matchIdx;
  }

  public nextMatch() {
    if (this.matchIdx !== undefined) {
      this.matchIdx = (this.matchIdx + 1) % this.matches.length;
    }
  }

  public prevMatch() {
    if (this.matchIdx !== undefined) {
      this.matchIdx = (this.matchIdx + this.matches.length - 1) % this.matches.length;
    }
  }

  public refreshMatches(props: RefreshMatchesProps): void {
    // The first check implies the second, but include here so we don't need an exclamation point throughout the
    // rest of the function.
    if (!this.editor || !this.lastCursorPos) {
      vscode.window.showErrorMessage(`Cannot refresh find matches when not in an editor`);
      return;
    }

    this.matches = new Document(this.editor.document.getText()).matches(props);

    // Update the decorations (always want these changes to be applied, hence why we do this first).
    this.editor.setDecorations(decorationType, this.matches.map(m => new vscode.Selection(m.start, m.end)));

    // Update the matchIdx
    this.matchIdx = this.matches.length === 0 ? undefined : sortedGTE(this.matches, new vscode.Range(this.lastCursorPos, this.lastCursorPos), (a: vscode.Range, b: vscode.Range) => {
      if (a.start.isEqual(b.start)) {
        return 0;
      }
      return a.start.isBeforeOrEqual(b.start) ? -1 : 1;
    });

    // If (potentially) no matches, just stay where we are (also check undefined so we don't need exclamation point in 'this.matchIdx!' after this if block)
    if (this.matchIdx === -1 || this.matchIdx === undefined) {
      // No match at all
      if (this.matches.length === 0) {
        this.matchIdx = undefined;
        return;
      }

      // Otherwise, cursor was after the last match, in which case we just need to wrap
      // around to the top of the file.
      this.matchIdx = 0;
    }

    const matchToFocus = this.matches[this.matchIdx];
    // We're at the same match, so don't do anything
    if (this.lastCursorPos.isEqual(matchToFocus.start)) {
      return;
    }

    // We're at a different match.
    if (props.prevMatchOnChange) {
      // Decrement the match
      this.matchIdx = (this.matchIdx + this.matches.length - 1) % this.matches.length;
    }

    // Update the beginning of this match.
    this.lastCursorPos = this.matches[this.matchIdx].start;
  }
}

class FindContextCache implements vscode.InlineCompletionItemProvider {
  private cache: FindContext[];
  private cacheIdx: number;
  private cursorStack: CursorStack;
  private replaceMode: boolean;
  private findPrevOnType: boolean;
  private regexToggle: boolean;
  private caseToggle: boolean;
  private wholeWordToggle: boolean;
  private active: boolean;
  private matchTracker: MatchTracker;

  constructor() {
    this.cache = [];
    this.cacheIdx = 0;
    this.cursorStack = new CursorStack();
    this.replaceMode = false;
    this.findPrevOnType = false;
    this.regexToggle = false;
    this.caseToggle = false;
    this.wholeWordToggle = false;
    this.active = false;
    this.matchTracker = new MatchTracker();
  }

  public toggleRegex() {
    this.regexToggle = !this.regexToggle;
    this.refreshMatches();
    this.focusMatch();
  }

  public toggleCase() {
    this.caseToggle = !this.caseToggle;
    this.refreshMatches();
    this.focusMatch();
  }

  public toggleWholeWord() {
    this.wholeWordToggle = !this.wholeWordToggle;
    this.refreshMatches();
    this.focusMatch();
  }

  public async toggleReplaceMode() {
    this.replaceMode = !this.replaceMode;
    this.refreshMatches();
    this.focusMatch();
  }

  public async startNew(findPrevOnType: boolean, initText?: string) : Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`Cannot activate find mode from outside an editor`);
      return;
    }
    this.matchTracker.setNewEditor(editor);

    this.active = true;
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
    this.refreshMatches();
    return this.focusMatch();
  }

  public async end(): Promise<void> {
    this.active = false;
    let lastCtx = this.cache.at(-1);
    if (lastCtx && lastCtx.findText.length === 0 && lastCtx.replaceText.length === 0) {
      this.cache.pop();
    }

    for (let [lastCtx, secondLastCtx] = [this.cache.at(-1), this.cache.at(-2)]; lastCtx && secondLastCtx && lastCtx.findText === secondLastCtx.findText && lastCtx.replaceText === secondLastCtx.replaceText; [lastCtx, secondLastCtx] = [this.cache.at(-1), this.cache.at(-2)]) {
      this.cache.pop();
    }
    this.replaceMode = false;
  }

  // This function is called by the registerInlineCompletionItemProvider handler.
  // It is not responsible for moving the cursor and instead will simply add the inline insertions
  // at the cursor's current position.
  async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.InlineCompletionList> {
    if (!this.active) {
      return { items: [] };
    }

    // Same order as find widget
    const codes = [];
    if (this.caseToggle) { codes.push("c"); }
    if (this.wholeWordToggle) { codes.push("w"); }
    if (this.regexToggle) { codes.push("r"); }

    let ctx = this.currentContext();
    const txt = this.replaceMode ? `\nFlags: [${codes.join("")}]\nText: ${ctx.findText}\nRepl: ${ctx.replaceText}` : `\nFlags: [${codes.join("")}]\nText: ${ctx.findText}`;
    return { items: [
      {
        insertText: txt,
        range: new vscode.Range(position, position),
      }
    ]};
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
    this.refreshMatches();
    return this.focusMatch();
  }

  public async prevContext(): Promise<void> {
    if (this.cacheIdx <= 0) {
      vscode.window.showInformationMessage("No earlier find contexts available");
      return;
    }
    this.cacheIdx--;
    this.cursorStack.clear();
    this.refreshMatches();
    return this.focusMatch();
  }

  public async insertText(s: string): Promise<void> {
    let ctx = this.currentContext();
    ctx.modified = true;
    if (this.replaceMode) {
      ctx.replaceText = ctx.replaceText.concat(s);
      // Don't need to refreshMatches because the matches don't change
      // when the replaceText is modified
    } else {
      ctx.findText = ctx.findText.concat(s);
      // Only refreshMatches when updating find text
      this.refreshMatches();
      this.cursorStack.push(this.matchTracker.getMatchIndex());
    }
    return this.focusMatch();
  }

  public async deleteLeft(): Promise<void> {
    let ctx = this.currentContext();
    if (this.replaceMode) {
      if (ctx.replaceText.length > 0) {
        ctx.modified = true;
        ctx.replaceText = ctx.replaceText.slice(0, ctx.replaceText.length - 1);
        // Don't need to refreshMatches because the matches don't change
        // when the replaceText is modified
      }
    } else {
      if (ctx.findText.length > 0) {
        ctx.modified = true;
        ctx.findText = ctx.findText.slice(0, ctx.findText.length - 1);

        this.refreshMatches();
        const popIdx = this.cursorStack.pop();
        if (popIdx !== undefined) {
          this.matchTracker.setMatchIndex(popIdx);
        }
        return this.focusMatch();
      }
    }
  }

  private refreshMatches() {
    this.matchTracker.refreshMatches({
      queryText: this.currentContext().findText,
      caseInsensitive: !this.caseToggle,
      regex: this.regexToggle,
      wholeWord: this.wholeWordToggle,
      prevMatchOnChange: this.findPrevOnType,
    });
  }

  private async focusMatch(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`Editor must have focus for find`);
      return;
    }

    const match = this.matchTracker.getMatch();

    // Move the cursor if necessary
    if (match) {
      // Put cursor at the end of the line that the match range ends at.
      const endLine = match.end.line;
      const newCursorPos = new vscode.Position(endLine, editor.document.lineAt(endLine).range.end.character);
      editor.selection = new vscode.Selection(newCursorPos, newCursorPos);

      // Update the editor focus
      editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    // Regardless of cursor move, update the inline suggestion.
    return vscode.commands.executeCommand("editor.action.inlineSuggest.hide").then(
      () => vscode.commands.executeCommand("editor.action.inlineSuggest.trigger"));
  }

  async prevMatch() {
    return this.nextOrPrevMatch(true);
  }

  async nextMatch() {
    return this.nextOrPrevMatch(false);
  }

  private async nextOrPrevMatch(prev: boolean) {
    // Most recent one will be empty
    const prevCache = this.cache.at(-2);
    const curCache = this.cache.at(-1);
    if (curCache && prevCache && !curCache.modified) {
      this.cache.pop();
      this.cacheIdx--;
      this.refreshMatches();
      return this.focusMatch();
    }

    if (prev) {
      this.matchTracker.prevMatch();
    } else {
      this.matchTracker.nextMatch();
    };
    this.focusMatch();
  }
}


export class FindHandler extends TypeHandler {
  readonly whenContext: string = "find";
  cache : FindContextCache;
  // If true, go to the previous match when typing
  findPrevOnType : boolean;
  // If true, we have a simpler find interaction (specifically, don't
  // refreshMatches on every type).
  simpleModeTracker : GlobalBoolTracker;

  constructor(cm: ColorMode) {
    super(cm, ModeColor.find);
    this.cache = new FindContextCache();
    this.findPrevOnType = false;
    this.simpleModeTracker = new GlobalBoolTracker("find.simpleMode", () => {
      vscode.window.showInformationMessage(`Simple Find Mode activated`);
    }, () => {
      vscode.window.showInformationMessage(`Regular Find Mode activated`);
    });
  }

  register(context: vscode.ExtensionContext, recorder: Recorder) {
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ scheme: 'file' }, this.cache));
    recorder.registerCommand(context, 'find', () => {
      if (this.isActive()) {
        return this.cache.nextMatch();
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
        vscode.window.showInformationMessage("groog.find.toggleReplaceMode can only be executed in find mode");
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
      this.simpleModeTracker.toggle(context);
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
    if (this.simpleModeTracker.get()) {
      const searchQuery = await vscode.window.showInputBox({
        placeHolder: "Search query",
        prompt: "Search text",
      });
      await this.cache.startNew(this.findPrevOnType, searchQuery);
    } else {
      await this.cache.startNew(this.findPrevOnType);
    }

  }

  async deactivateCommands() {
    await vscode.commands.executeCommand("cancelSelection");
    await vscode.commands.executeCommand("editor.action.inlineSuggest.hide");
    vscode.window.activeTextEditor?.setDecorations(decorationType, []);
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
  matchIndexes: (number | undefined)[];

  constructor() {
    this.matchIndexes = [];
  }

  // Note: using the matchIdx as the way to get cursor position isn't perfect
  // because if we replace a value, then when we backspace, it'll go to the wrong
  // spot. However, it beats the alternative where we use cursor, but a multi-line
  // replacement happens, and then we just go to some random spot in the code.
  push(matchIdx?: number) {
    this.matchIndexes.push(matchIdx);
  }

  pop(): number | undefined {
    return this.matchIndexes.pop();
  }

  clear() {
    this.matchIndexes = [];
  }
}
