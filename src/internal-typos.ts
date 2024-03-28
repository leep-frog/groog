// Used https://github.com/genesy/auto-correct as guidance for this logic.
import * as vscode from 'vscode';
import { getWordSeparators } from './settings';
import { Correction, defaultCorrections, globalLanguageKey } from './typos';

const whitespaceCharBreakKey = "WHITESPACE";

// Types used internally
interface CorrectionOptions {
  // All fields are required since we construct this internally only.
  replacementText: string;
  replacementTextAfterCursor: string;
  excludeBreakCharacter: boolean;
}

interface BreakCharToOptions {
  // Key is break character
  [key: string]: CorrectionOptions;
}

interface InternalCorrector {
  // Key is word
  [key: string]: BreakCharToOptions;
}

interface InternalCorrectorsByLanguage {
  // Key is language ID
  [key: string]: InternalCorrector;
}

const lastWordPattern = /\b([a-zA-Z]*)$/;

export class TypoFixer {
  // map from language to char to correction options
  perLanguageCorrections: InternalCorrectorsByLanguage;
  globalCorrections: InternalCorrector;
  defaultBreakCharacters: string;

  constructor() {
    this.perLanguageCorrections = {};
    this.globalCorrections = {};
    this.defaultBreakCharacters = "";
    this.reload();
  }

  register(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("groog")) {
        this.reload();
      }
    }));
  }

  private reload() : void {
    const config = vscode.workspace.getConfiguration("groog", vscode.window.activeTextEditor?.document.uri);
    const corrections = config.get<Correction[]>("typos");

    const [_, separators] = getWordSeparators();
    if (!separators) {
      vscode.window.showErrorMessage("Failed to get editor.wordSeparator; defaulting to space character");
      this.defaultBreakCharacters = " ";
    } else {
      this.defaultBreakCharacters = separators;
    }

    this.perLanguageCorrections = this.externalTypoToInternal((corrections || []).concat(defaultCorrections()));
    this.globalCorrections = this.perLanguageCorrections[globalLanguageKey];
  }

  async check(char: string) : Promise<boolean> {
    // Only run if the user just inserted a word break character or a whitespace character.
    if (!this.defaultBreakCharacters.includes(char) && !this.isWhitespaceChar(char)) {
      return false;
    }

    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Couldn't find active editor");
      return false;
    }

    // Don't run if highlighting a section
    if (!editor.selection.start.isEqual(editor.selection.end)) {
      return false;
    }

    // Get the last word.
    const lastWordData = this.lastWord(editor);
    if (!lastWordData) {
      return false;
    }
    const [word, lastWordRange] : [string, vscode.Range] = lastWordData;

    // First run the language specific correction.
    if (editor.document.languageId in this.perLanguageCorrections) {
      const byBreakChar = this.perLanguageCorrections[editor.document.languageId];
      if ((await this.runCorrection(byBreakChar, editor, char, word, lastWordRange))) {
        return true;
      }
    }

    // If no match on language specific correction, then try the global one.
    return this.runCorrection(this.globalCorrections, editor, char, word, lastWordRange);
  }

  async runCorrection(corrector : InternalCorrector | undefined, editor : vscode.TextEditor, breakCharacter: string, word : string, lastWordRange : vscode.Range) : Promise<boolean> {
    if (!corrector || !(word in corrector)) {
      return false;
    }

    const options = this.getOptions(corrector[word], breakCharacter);
    if (!options) {
      return false;
    }

    await editor.edit(
      editBuilder => {
        editBuilder.delete(lastWordRange);
        editBuilder.insert(
          lastWordRange.start,
          options.replacementText + (!!options.excludeBreakCharacter ? "" : breakCharacter) + options.replacementTextAfterCursor,
        );
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );

    // Move cursor to before replacementTextAfterCursor portion
    if (options.replacementTextAfterCursor.length > 0) {
      // position.translate and cursorMove does not doesn't move across newline characters.
      // It just errors due to a negative 'character' value, hence why we do our own
      // custom logic to determine exact cursor position here.

      const textByLine = options.replacementTextAfterCursor.split("\n");
      const lineOffset = textByLine.length - 1;
      const cursorOffset = textByLine[0].length;

      let toPos : vscode.Position;
      if (lineOffset === 0) {
        // We didn't jump across lines, so simply translate
        toPos = editor.selection.start.translate(-lineOffset, -cursorOffset);
      } else {
        // We changed lines, so determine the line where the replacementTextAfterCursor started and only offset form there
        const afterCursorReplacementStartLine = editor.document.lineAt(editor.selection.start.line-lineOffset);
        const endChar = afterCursorReplacementStartLine.range.end.character;
        toPos = new vscode.Position(afterCursorReplacementStartLine.lineNumber, endChar - textByLine[0].length);
      }
      editor.selection = new vscode.Selection(toPos, toPos);
    }
    return true;
  }

  getOptions(byBreakChar : BreakCharToOptions, breakCharacter : string) : CorrectionOptions | undefined {
    if (breakCharacter in byBreakChar) {
      return byBreakChar[breakCharacter];
    } else if (this.isWhitespaceChar(breakCharacter) && whitespaceCharBreakKey in byBreakChar) {
      return byBreakChar[whitespaceCharBreakKey];
    }
  }

  isWhitespaceChar(c : string): boolean {
    return /\s/.test(c);
  }

  lastWord(editor : vscode.TextEditor) : [string, vscode.Range] | undefined {
    const startPos = editor.selection.start;
    const range = new vscode.Range(new vscode.Position(startPos.line, 0), startPos);
    const text = editor.document.getText(range);
    const matchedText = text.match(lastWordPattern);
    if (!matchedText || matchedText.length < 1) {
      return;
    }
    const word = matchedText[1];
    return [word, new vscode.Range(startPos.translate(undefined, -word.length), startPos)];
  }

  externalTypoToInternal(corrections : Correction[]) : InternalCorrectorsByLanguage {
    const langCs : InternalCorrectorsByLanguage = {};

    // Iterate over all corrections
    for (const correction of corrections) {

      // Iterate over words
      for (const word in correction.words) {

        const opts : CorrectionOptions = {
          replacementText: correction.words[word] + (correction.replacementSuffix || ""),
          replacementTextAfterCursor: correction.replacementSuffixAfterCursor || "",
          excludeBreakCharacter: !!correction.excludeBreakCharacter,
        };

        // Iterate over languages (or global if none provided)
        for (const langId of (correction.languages || [globalLanguageKey])) {
          if (!(langId in langCs)) {
            langCs[langId] = {};
          }
          const corrector = langCs[langId];

          if (!(word in corrector)) {
            corrector[word] = {};
          }

          const byBreakChar = corrector[word];

          const breakChars = this.getBreakChars(correction);

          // Iterate over break characters
          for (const breakChar of breakChars) {
            // Add correction
            byBreakChar[breakChar] = opts;
          }
        }
      }
    }
    return langCs;
  }

  getBreakChars(correction : Correction) : string[] {
    if (correction.breakCharacters !== undefined) {
      return correction.breakCharacters.split("");
    }
    return this.defaultBreakCharacters.split("").concat([whitespaceCharBreakKey]);
  }
}
