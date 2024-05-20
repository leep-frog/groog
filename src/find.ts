import * as vscode from 'vscode';
import { ColorMode, HandlerColoring, gutterHandlerColoring } from './color_mode';
import { Emacs, GlobalBoolTracker } from './emacs';
import { TypeHandler } from './handler';
import { CursorMove, DeleteCommand, setGroogContext } from './interfaces';
import { positiveMod } from './misc-command';
import { Record, Recorder } from './record';

function findColor(opacity?: number): string{
  return `rgba(200, 120, 0, ${opacity ?? 1})`;
}

const allMatchDecorationType = vscode.window.createTextEditorDecorationType({
  overviewRulerColor: findColor(),
  backgroundColor: findColor(0.3),
});

const currentMatchDecorationType = vscode.window.createTextEditorDecorationType({
  overviewRulerColor: findColor(),
  backgroundColor: findColor(0.7),
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

export interface Match {
  range: vscode.Range;
  text: string;
  pattern: RegExp;
  index: number;
}

export class Document {
  documentText: string;

  // The indices of all newline characters;
  newlineIndices: number[];

  constructor(documentText: string) {
    this.documentText = documentText;
    this.newlineIndices = [];
    for (let i = 0; i < this.documentText.length; i++) {
      if (this.documentText.charAt(i) === "\n") {
        this.newlineIndices.push(i);
      }
    }
    this.newlineIndices.push(this.documentText.length);
  }

  private createRegex(s: string, caseInsensitive: boolean): [RegExp, string | undefined] {
    try {
      return [new RegExp(s, `gm${caseInsensitive ? "i" : ""}`), undefined];
    } catch (error) {
      return [new RegExp("."), (error as SyntaxError).message];
    }
  }

  // Returns matches, suggestible matches, and errors
  public matches(props: DocumentMatchProps): [Match[], string[], string | undefined] {
    if (props.queryText.length === 0) {
      return [[], [], undefined];
    }

    const text = this.documentText;

    if (props.caseInsensitive) {
      props.queryText = props.queryText.toLowerCase();
    }
    // "g" is the global flag which is required here.
    const rgxTxt = props.regex ? props.queryText : escapeStringRegexp(props.queryText);
    const [rgx, err] = this.createRegex(rgxTxt, props.caseInsensitive);
    if (err) {
      return [[], [], err];
    }

    const matches = Array.from(text.matchAll(rgx));
    const suggestibleMatches: Set<string> = new Set<string>();
    return [matches
      .map(m => {
        return {
          startIndex: m.index!,
          // Note: end index is exclusive
          endIndex: m.index! + m[0].length,
          text: m[0],
        };
      })
      .filter(m => {
        if (!props.wholeWord) {
          return true;
        }

        // If the first character is a word character than the preceding one must not be.
        if (WORD_PARTS.test(this.documentText[m.startIndex])) {
          if (m.startIndex > 0 && WORD_PARTS.test(this.documentText[m.startIndex - 1])) {
            return false;
          }
        }

        // If the last character is a word character than the next one must not be.
        if (WORD_PARTS.test(this.documentText[m.endIndex-1])) {
          if (m.endIndex < this.documentText.length && WORD_PARTS.test(this.documentText[m.endIndex])) {
            let lastIndex = m.endIndex;
            for (; lastIndex < this.documentText.length && WORD_PARTS.test(this.documentText[lastIndex]); lastIndex++) {}
            suggestibleMatches.add(this.documentText.substring(m.startIndex, lastIndex));
            return false;
          }
        }

        return true;
      })
      .map((m, index) => {
        return {
          text: m.text,
          range: new vscode.Range(
            this.posFromIndex(m.startIndex),
            this.posFromIndex(m.endIndex),
          ),
          pattern: rgx,
          index,
        };
      }), [...suggestibleMatches].sort(), undefined];
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

// WORD_PARTS is the set of characters that constituted part of a word
// (and the inverse set is the set of characters that end a word for whole word toggle).
const WORD_PARTS = new RegExp("[a-zA-Z0-9]");

interface MatchInfo {
  matches: Match[];
  match: Match;
}

interface MatchInfoResponse {
  info?: MatchInfo;
  suggestibleMatches: string[];
  error?: string;
}

class MatchTracker {
  private matchInfo?: MatchInfo;
  private editor: vscode.TextEditor;
  cursorReferencePosition: vscode.Position;
  private matchError?: string;
  private suggestibleMatches: string[];

  constructor(editor: vscode.TextEditor) {
    this.editor = editor;
    this.cursorReferencePosition = editor.selection.start;
    this.suggestibleMatches = [];
  }

  public setMatchIndex(idx: number) {
    if (this.matchInfo === undefined) {
      return;
    }

    if (idx < 0 || idx >= this.matchInfo.matches.length) {
      return;
    }
    this.matchInfo.match = this.matchInfo.matches[idx];
  }

  // Return (MatchInfo, error)
  public getMatchInfo(): MatchInfoResponse {
    return {
      info: this.matchInfo,
      error: this.matchError,
      suggestibleMatches: this.suggestibleMatches,
    };
  }

  public nextMatch() {
    this.nextOrPrevMatch(1);
  }

  public prevMatch() {
    this.nextOrPrevMatch(-1);
  }

  public nextOrPrevMatch(offset: number) {
    if (this.matchInfo !== undefined) {
      this.setMatchIndex(positiveMod(this.matchInfo.match.index + offset, this.matchInfo.matches.length));
    }
  }

  public updateCursor() {
    this.cursorReferencePosition = this.editor.selection.anchor;
  }

  public refreshMatches(props: RefreshMatchesProps): void {
    const [matches, suggestibleMatches, mErr] = new Document(this.editor.document.getText()).matches(props);
    this.suggestibleMatches = suggestibleMatches;
    this.matchError = mErr;

    // Update the matchIdx
    let matchIdx = matches.length === 0 ? undefined : sortedGTE(matches.map(m => m.range), new vscode.Range(this.cursorReferencePosition, this.cursorReferencePosition), (a: vscode.Range, b: vscode.Range) => {
      if (a.start.isEqual(b.start)) {
        return 0;
      }
      return a.start.isBeforeOrEqual(b.start) ? -1 : 1;
    });

    // If (potentially) no matches, just stay where we are (also check undefined so we don't need exclamation point in 'this.matchIdx!' after this if block)
    if (matchIdx === -1 || matchIdx === undefined) {
      // No match at all
      if (matches.length === 0) {
        this.matchInfo = undefined;
        return;
      }

      // Otherwise, cursor was after the last match, in which case we just need to wrap
      // around to the top of the file.
      matchIdx = 0;
    }

    const matchToFocus = matches[matchIdx];
    // We're at the same match, so don't do anything
    if (this.cursorReferencePosition.isEqual(matchToFocus.range.start)) {
      // Don't do anything
    } else if (props.prevMatchOnChange) { // We're at a different match.
      // Decrement the match
      matchIdx = (matchIdx + matches.length - 1) % matches.length;
    }

    this.matchInfo = {
      matches,
      match: matches[matchIdx],
    };
  }
}

class FindContextCache {
  private cache: FindContext[];
  private cacheIdx: number;
  private replaceMode: boolean;
  private findPrevOnType: boolean;
  private regexToggle: boolean;
  private caseToggle: boolean;
  private wholeWordToggle: boolean;
  private active: boolean;
  // This is only undefined on extension initialization, but it is forced to be set on
  // all find mode activations, so all calls of it can force it's presence (`matchTracker!.`)
  private matchTracker?: MatchTracker;
  public nexts: number;
  public lastRefreshProps: RefreshMatchesProps;

  constructor() {
    this.cache = [];
    this.cacheIdx = 0;
    this.replaceMode = false;
    this.findPrevOnType = false;
    this.regexToggle = false;
    this.caseToggle = false;
    this.wholeWordToggle = false;
    this.active = false;
    this.nexts = 0;
    this.lastRefreshProps = {
      queryText: "",
      caseInsensitive: false,
      prevMatchOnChange: false,
      regex: false,
      wholeWord: false,
    };
  }

  public toggleRegex() {
    this.regexToggle = !this.regexToggle;
    if (this.active) {
      this.refreshMatches();
      this.focusMatch();
    }
  }

  public toggleCase() {
    this.caseToggle = !this.caseToggle;
    if (this.active) {
      this.refreshMatches();
      this.focusMatch();
    }
  }

  public toggleWholeWord() {
    this.wholeWordToggle = !this.wholeWordToggle;
    if (this.active) {
      this.refreshMatches();
      this.focusMatch();
    }
  }

  public async toggleReplaceMode() {
    this.replaceMode = !this.replaceMode;
    if (this.active) {
      this.refreshMatches();
      this.focusMatch();
    }
  }

  public async replace(all: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`Cannot replace matches from outside an editor`);
      return;
    }

    const matchInfoResponse = this.matchTracker!.getMatchInfo();
    const matchInfo = matchInfoResponse.info;
    const err = matchInfoResponse.error;
    if (err) {
      vscode.window.showErrorMessage(`Failed to get match info: ${err}`);
      return;
    }
    if (!matchInfo) {
      return;
    }
    const toReplace = all ? matchInfo.matches : [matchInfo.match];
    return editor.edit(eb => {
      toReplace.forEach((r) => {
        // If regex mode, than replace using string.replace so that
        // group replacements are made.
        const ctx = this.currentContext();
        eb.replace(r.range, this.regexToggle ? r.text.replace(r.pattern, ctx.replaceText) : ctx.replaceText);
      });
    }).then(() => {
      this.refreshMatches();
      return this.focusMatch();
    });
  }

  public async startNew(findPrevOnType: boolean, initText?: string) : Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    this.nexts = 0;
    this.lastRefreshProps = {
      queryText: "",
      caseInsensitive: false,
      prevMatchOnChange: false,
      regex: false,
      wholeWord: false,
    };
    if (!editor) {
      vscode.window.showErrorMessage(`Cannot activate find mode from outside an editor`);
      return false;
    }
    this.matchTracker = new MatchTracker(editor);

    this.active = true;
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
    return this.focusMatch().then(() => true);
  }

  public async end(): Promise<void> {
    if (!this.matchTracker) {
      // If here, then failed to start. startNew is responsible for notifications, so just return here;
      return;
    }
    // Focus on the last match (if relevant)
    const matchInfoResponse = this.matchTracker!.getMatchInfo();
    const matchInfo = matchInfoResponse.info;
    const err = matchInfoResponse.error;
    if (err) {
      vscode.window.showInformationMessage(`Failed to get match info: ${err}`);
      return;
    }
    if (matchInfo) {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(`Cannot select text from outside the editor`);
      } else {
        editor.selection = new vscode.Selection(matchInfo.match.range.start, matchInfo.match.range.end);
      }
    }
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

  private currentContext() : FindContext {
    return this.cache[this.cacheIdx ?? this.cache.length-1];
  }

  public async nextContext(): Promise<void> {
    if (this.cacheIdx >= this.cache.length-1) {
      vscode.window.showInformationMessage("End of find cache");
      return;
    }
    this.cacheIdx++;
    this.refreshMatches();
    return this.focusMatch();
  }

  public async prevContext(): Promise<void> {
    if (this.cacheIdx <= 0) {
      vscode.window.showInformationMessage("No earlier find contexts available");
      return;
    }
    this.cacheIdx--;
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
    }
    return this.focusMatch();
  }

  public async setText(s: string): Promise<void> {
    let ctx = this.currentContext();
    ctx.modified = true;
    ctx.findText = s;
    this.refreshMatches();
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
      }
    }
    // Always focusMatch because that regenerates the inline text.
    return this.focusMatch();
  }

  private refreshMatches() {
    this.lastRefreshProps = {
      queryText: this.currentContext().findText,
      caseInsensitive: !this.caseToggle,
      regex: this.regexToggle,
      wholeWord: this.wholeWordToggle,
      prevMatchOnChange: this.findPrevOnType,
    };
    this.matchTracker!.refreshMatches(this.lastRefreshProps);
  }


  /**
   * appendVerticalLine appends a `|` character if the string ends with a space.
   * Note: not relevant if the string ends with newline, tab, etc. as those are
   * expected to be irrelevant for quick pick.
   *
   * @param s the
   */
  private appendVerticalLine(s: string): string {
    return s.endsWith(" ") ? s + "|" : s;
  }

  private async focusMatch(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`Editor must have focus for find`);
      return;
    }

    const matchInfoResponse = this.matchTracker!.getMatchInfo();
    const matchInfo = matchInfoResponse.info;
    const matchError = matchInfoResponse.error;
    const match = matchInfo?.match;
    const suggestibleMatches = match ? [] : matchInfoResponse.suggestibleMatches;
    const matches = matchInfo ? matchInfo.matches : [];

    // Update the decorations (always want these changes to be applied, hence why we do this first).
    editor.setDecorations(allMatchDecorationType, matches.filter((m) => !match || !m.range.isEqual(match.range)).map(m => new vscode.Selection(m.range.start, m.range.end)));
    editor.setDecorations(currentMatchDecorationType, match ? [match] : []);

    // Move the cursor if necessary
    if (match) {
      // Update the cursor and editor focus
      editor.selection = new vscode.Selection(match.range.start, match.range.end);
      editor.revealRange(match.range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } else if (this.matchTracker!.cursorReferencePosition) {
      editor.selection = new vscode.Selection(this.matchTracker!.cursorReferencePosition, this.matchTracker!.cursorReferencePosition);
      // Focus back on initial cursor position
      editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }

    // Regardless of cursor move, update the find display.

    // Set codes
    const codes = [];
    if (this.caseToggle) { codes.push("C"); }
    if (this.wholeWordToggle) { codes.push("W"); }
    if (this.regexToggle) { codes.push("R"); }

    // Create items (find info)
    const matchText = !matchInfo ? `No results` : `${matchInfo.match.index + 1} of ${matches.length}`;
    const ctx = this.currentContext();
    const detail = this.replaceMode ? (ctx.replaceText.length === 0 ? "No replace text set" : this.appendVerticalLine(ctx.replaceText)) : undefined;
    const suggestibleItems = suggestibleMatches.map((sm: string) : FindQuickPickItem => {
      return {
        label: sm,
        pickable: true,
      };
    });
    const items: FindQuickPickItem[] = [
      {
        label: this.appendVerticalLine(ctx.findText) || " ",
        detail: detail,
        description: matchError ? matchError : undefined,
      },
      {
        label: `Flags: [${codes.join("")}]`,
      },
      {
        label: matchText,
      },
      ...suggestibleItems,
    ];

    const disposables: vscode.Disposable[] = [];
    const input = vscode.window.createQuickPick<FindQuickPickItem>();
    input.items = items;
    input.title = "Find Mode";

    if (suggestibleMatches.length > 0) {
      input.activeItems = [suggestibleItems[0]];
      input.selectedItems = [suggestibleItems[0]];
    }

    disposables.push(
      // Dispose of events when leaving the widget.
      input.onDidHide(e => {
        disposables.forEach(d => d.dispose);
      }),
      // When accepting an event, run the record book!
      input.onDidAccept(e => {
        if (input.selectedItems.length > 1) {
          vscode.window.showErrorMessage(`Multiple selections made somehow?!`);
        }
        if (input.selectedItems.length === 0) {
          return;
        }

        const item = input.selectedItems[0];
        if (!item.pickable) {
          return;
        }

        this.setText(item.label);
        input.dispose();
      }),
    );
    return input.show();
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
      this.nexts--;
      this.matchTracker!.prevMatch();
    } else {
      this.nexts++;
      this.matchTracker!.nextMatch();
    };
    this.focusMatch();
    this.matchTracker!.updateCursor();
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
  recorder: Recorder;

  constructor(cm: ColorMode, recorder: Recorder) {
    super(cm);
    this.cache = new FindContextCache();
    this.findPrevOnType = false;
    this.simpleModeTracker = new GlobalBoolTracker("find.simpleMode", () => {
      vscode.window.showInformationMessage(`Simple Find Mode activated`);
      return setGroogContext("find.simple", true);
    }, () => {
      vscode.window.showInformationMessage(`Regular Find Mode activated`);
      return setGroogContext("find.simple", false);
    });
    this.recorder = recorder;
  }

  getColoring(context: vscode.ExtensionContext): HandlerColoring {
    return gutterHandlerColoring(context, "find");
  }

  registerHandler(context: vscode.ExtensionContext, recorder: Recorder) {
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

    recorder.registerCommand(context, 'find.replaceOne', async () => {
      if (!this.isActive()) {
        vscode.window.showErrorMessage(`Cannot replace matches when not in groog.find mode`);
        return;
      }
      return this.cache.replace(false);
    });
    recorder.registerCommand(context, 'find.replaceAll', async () => {
      if (!this.isActive()) {
        vscode.window.showErrorMessage(`Cannot replace matches when not in groog.find mode`);
        return;
      }
      return this.cache.replace(true);
    });

    recorder.registerCommand(context, 'find.toggleReplaceMode', async (): Promise<void> => {
      if (!this.isActive()) {
        vscode.window.showErrorMessage("groog.find.toggleReplaceMode can only be executed in find mode");
        return;
      }
      return this.cache.toggleReplaceMode();
    });

    // Goes to previous find context
    recorder.registerCommand(context, 'find.previous', async (): Promise<void> => {
      if (!this.isActive()) {
        vscode.window.showErrorMessage("groog.find.previous can only be executed in find mode");
        return;
      }
      return this.cache.prevContext();
    });
    // Goes to next find context
    recorder.registerCommand(context, 'find.next', async () => {
      if (!this.isActive()) {
        vscode.window.showErrorMessage("groog.find.next can only be executed in find mode");
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
    let started = false;
    if (this.simpleModeTracker.get()) {
      const searchQuery = await vscode.window.showInputBox({
        placeHolder: "Search query",
        prompt: "Search text",
      });
      started = await this.cache.startNew(this.findPrevOnType, searchQuery);
    } else {
      started = await this.cache.startNew(this.findPrevOnType);
    }
    if (!started) {
      return this.deactivate();
    }
  }
  onRedundantActivate(): void {}

  async deactivateCommands() {
    // Don't `cancelSelection` as we select the previously matched text.
    vscode.commands.executeCommand("workbench.action.closeQuickOpen");
    vscode.window.activeTextEditor?.setDecorations(allMatchDecorationType, []);
    vscode.window.activeTextEditor?.setDecorations(currentMatchDecorationType, []);
  }

  async handleDeactivation() {
    await this.cache.end();
    await this.deactivateCommands();
    this.findPrevOnType = false;
    if (this.recorder.isActive()) {
      this.recorder.addRecord(new FindRecord(this.cache.nexts, this.cache.lastRefreshProps));
    }
  }

  async ctrlG(): Promise<boolean> {
    // Don't run ctrl+g commands.
    return this.deactivate().then(() => false);
  }

  async textHandler(s: string): Promise<boolean> {
    // Enter, shift+enter, ctrl+n, ctrl+p taken care of in package.json
    return this.cache.insertText(s).then(() => false);
  }

  async moveHandler(cmd: CursorMove): Promise<boolean> {
    return this.deactivate().then(() => true);
  }

  async delHandler(s: DeleteCommand): Promise<boolean> {
    if (s === DeleteCommand.Left) {
      return this.cache.deleteLeft().then(() => false);
    }
    vscode.window.showErrorMessage(`Unsupported find command: groog.${s}`);
    return false;
  }

  // TODO: do something like error message or deactivate
  async onYank() { }
  alwaysOnYank: boolean = false;
  async onKill(s: string | undefined) { }
  alwaysOnKill: boolean = false;

  async onPaste(text: string): Promise<boolean> {
    return this.cache.insertText(text).then(() => false);
  }
  async onEmacsPaste(text: string): Promise<boolean> {
    return this.cache.insertText(text).then(() => false);
  }

  async testReset() {
    this.deactivate();
    this.cache = new FindContextCache();
  }
}

export class FindRecord implements Record {
  private nexts: number;
  private matchProps: RefreshMatchesProps;

  numMatches: number;

  matchIdx: number;

  constructor(nexts: number, props: RefreshMatchesProps, numMatches?: number, matchIdx?: number) {
    this.nexts = nexts;
    this.matchProps = props;
    this.numMatches = numMatches ?? 0;
    this.matchIdx = matchIdx ?? -1;
  }

  async playback(emacs: Emacs, repeatMode?: boolean): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(`Cannot find without an active editor`);
      return false;
    }
    const matchTracker = new MatchTracker(editor);
    matchTracker.refreshMatches(this.matchProps);
    matchTracker.nextOrPrevMatch(this.nexts);
    const matchInfoResponse = matchTracker.getMatchInfo();
    const matchInfo = matchInfoResponse.info;
    const matchError = matchInfoResponse.error;
    if (matchError) {
      vscode.window.showErrorMessage(`Failed to playback find recording: ${matchError}`);
      return false;
    }

    if (!matchInfo) {
      vscode.window.showErrorMessage(`No match found during recording playback`);
      return false;
    }

    if (Math.abs(this.nexts) >= matchInfo.matches.length) {
      if (!repeatMode) {
        vscode.window.showErrorMessage(`There are ${matchInfo.matches.length} matches, but the FindRecord requires at least ${Math.abs(this.nexts)+1}`);
      }
      return false;
    }

    const match = matchInfo.match;

    editor.selection = new vscode.Selection(match.range.start, match.range.end);

    this.numMatches = matchInfo.matches.length;
    // This will be set due to !match check above
    this.matchIdx = matchInfo.match.index;

    return true;
  }

  noop(): boolean {
    return false;
  }

  eat(next: Record): boolean {
    return false;
  }

  async undo(): Promise<boolean> {
    return false;
  }
}

interface FindQuickPickItem extends vscode.QuickPickItem {
  pickable?: boolean;
}
