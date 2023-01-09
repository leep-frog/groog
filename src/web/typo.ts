// Used https://github.com/genesy/auto-correct as guidance for this logic.
import * as vscode from 'vscode';

export interface Words {
  [key: string]: string;
}

interface TypoMap {
  [key: string]: Correction;
}

interface LanguageTypoMap {
  [key: string]: TypoMap;
}

// TODO: Get this from 'editor.wordSeparators + whitespace chars'
const defaultWordBreakCharacters = " `~!@#$%^&*()-=+[{]}\\|;:'\",.<>/?_";
const lastWordPattern = /\b([a-zA-Z]*)$/;

interface Correction {
  // The language for which the correction applies. The correction is applied
  // to all files if this is undefined.
  language?: string;
  words: Words;

  // Characters that count as a word break.
  wordBreakCharacters?: string[];
  replacementSuffix?: string;
  replacementSuffixAfterCursor?: string;
}

export class TypoFixer {
  // map from language to char to correction options
  perLanguageCorrections: LanguageTypoMap;
  globalCorrections: TypoMap;

  constructor() {
    this.perLanguageCorrections = {
      "jsonc": {
        " ": {
          words: {
            "pritn": "PRINT",
          },
        },
      }
    };
    this.globalCorrections = {
      " ": {
        words: {
          "pritn": "print",
        },
      },
    };
  }

  async check(char: string) : Promise<boolean> {
    // Only run if the user just inserted a word break character.
    if (!defaultWordBreakCharacters.includes(char)) {
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

  async runCorrection(typoMap : TypoMap | undefined, editor : vscode.TextEditor, breakCharacter: string) : Promise<boolean> {
    if (!typoMap || !(breakCharacter in typoMap)) {
      return false;
    }
    const correction = typoMap[breakCharacter];

    const lastWordData = this.lastWord(editor);
    if (!lastWordData) {
      return false;
    }

    const [word, lastWordRange] : [string, vscode.Range] = lastWordData;
    if (!(word in correction.words)) {
      return false;
    }

    const replacementText = correction.words[word];

    await editor.edit(
      editBuilder => {
        editBuilder.delete(lastWordRange);
        editBuilder.insert(lastWordRange.start, replacementText + breakCharacter);
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
}



/*export class TypoFixer implements Registerable {

  register(context: vscode.ExtensionContext, recorder: Recorder): void {
    vscode.workspace.onDidOpenTextDocument(() => {
      words = words || getWords(config);
    });
    vscode.workspace.onDidChangeTextDocument(event => {
      words = words || getWords(config);
      correctTheWord(event);
    });
  };

}

function correctTheWord(event: vscode.TextDocumentChangeEvent): void {
  if (!event.contentChanges.length) {
    return;
  }

  if (event.contentChanges.length > 1) {
    vscode.window.showInformationMessage("More than one content change");
  }

  // TODO: Record: execute as one transaction
  for (const change of event.contentChanges) {

  }

  const change = event.contentChanges[0];
  const { document } = event;

  change.

  const replacedRange = event.contentChanges[0].range;
  const cursorPlusOne = document.selection.start.translate(0, 1);
  const lineStart = new vscode.Position(cursorPlusOne.line, 0);
  const text = editor.document.getText(
    new vscode.Range(lineStart, cursorPlusOne)
  );

  // TODO: HERE
  // matches letters and special letters
  const lastWord = getLastWord(text);

  if (!lastWord) {
    return;
  }

  if (Object.keys(words).includes(lastWord)) {
    editor.edit(
      editBuilder => {
        const contentChangeRange = event.contentChanges[0].range;
        const startLine = contentChangeRange.start.line;
        const startCharacter = contentChangeRange.start.character;
        const start = new vscode.Position(startLine, startCharacter);
        const end = new vscode.Position(
          startLine,
          startCharacter - lastWord.length
        );

        editBuilder.delete(new vscode.Range(start, end));
        editBuilder.insert(start, words[lastWord]);
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      }
    );
  }
}

export function getLastWord(inputText: string): string | undefined {
  const re = /((\p{L}|[><=+.,;@*()?!#$€%§&_'"\/\\-])+)[-_><\W]?$/gu;
  const match = re.exec(inputText);
  return match && match.length > 1 ? match[1] : undefined;
}
*/
