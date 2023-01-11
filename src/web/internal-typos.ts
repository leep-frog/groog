// Used https://github.com/genesy/auto-correct as guidance for this logic.
import * as vscode from 'vscode';
import { getWordSeparators } from './settings';
import { Correction, defaultCorrections } from './typos';

// TODO: Case match?

export const globalLanguageKey = "*";
export const goLanguageKey = "golang";
export const jsoncLanguageKey = "jsonc";
export const jsonLanguageKey = "json";

// Types stored in settings

// Types used internally
interface CorrectionOptions {
  replacementText: string;
  replacementTextAfterCursor?: string;
}

interface WordsToOptions {
  // Key is word
  [key: string]: CorrectionOptions;
}

interface InternalCorrector {
  // Key is break character
  [key: string]: WordsToOptions;
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

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("groog")) {
        this.reload();
      }
    });
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
    if (!this.defaultBreakCharacters.includes(char) && !/\s/.test(char)) {
      return false;
    }

    // TODO: what happens if this doesn't have focus?
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("Couldn't find active editor");
      return false;
    }

    // First run the language specific correction
    if (editor.document.languageId in this.perLanguageCorrections) {
      const byBreakChar = this.perLanguageCorrections[editor.document.languageId];
      if ((await this.runCorrection(byBreakChar, editor, char))) {
        return true;
      }
    }

    return this.runCorrection(this.globalCorrections, editor, char);
  }

  async runCorrection(corrector : InternalCorrector | undefined, editor : vscode.TextEditor, breakCharacter: string) : Promise<boolean> {
    // START: Get this outside of run correction.
    const lastWordData = this.lastWord(editor);
    if (!lastWordData) {
      return false;
    }


    const [word, lastWordRange] : [string, vscode.Range] = lastWordData;
    // END: Get this outside of run correction

    if (!corrector || !(breakCharacter in corrector) || !(word in corrector[breakCharacter])) {
      return false;
    }

    const options = corrector[breakCharacter][word];
    await editor.edit(
      editBuilder => {
        editBuilder.delete(lastWordRange);
        editBuilder.insert(lastWordRange.start, options.replacementText + breakCharacter);
      },
      {
        // TODO: Do this in record.ts!!!
        undoStopAfter: false,
        undoStopBefore: false,
      }
    );
    return true;
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

        // TODO: replacementSuffixAfterCursor
        const opts : CorrectionOptions = {
          replacementText: correction.words[word] + (correction.replacementSuffix || ""),
        };

        // Iterate over languages (or global if none provided)
        for (const langId of (correction.languages || [globalLanguageKey])) {
          if (!(langId in langCs)) {
            langCs[langId] = {};
          }
          const corrector = langCs[langId];

          // Iterate over break characters
          for (const breakChar of (correction.breakChars || this.defaultBreakCharacters)) {
            if (!(breakChar in corrector)) {
              corrector[breakChar] = {};
            }

            // Add correction
            corrector[breakChar][word] = opts;
          }
        }
      }
    }
    return langCs;
  }
}
