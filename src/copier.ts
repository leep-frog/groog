import * as vscode from 'vscode';
import { getPrefixText } from './handler';
import { guessLanguageSpec } from './language-behavior';

interface PastableLine {
  text: string;
  numIndents: number;
  originalIndentation: string;
}

export class Copier {

  pastableLines: PastableLine[];
  firstLineIndentCount: number

  constructor(text: string, fromIndentation?: string, firstLineIndentation?: string, firstLinePrefixHasText?: boolean) {
    fromIndentation = fromIndentation ?? this.deduceFromIndentation(text);
    this.pastableLines = this.parse(text, fromIndentation, !!firstLinePrefixHasText);

    this.firstLineIndentCount = firstLineIndentation !== undefined ? whitespaceSubstringCount(firstLineIndentation, fromIndentation) : this.guessHiddenIndentation();
  }

  private deduceFromIndentation(text: string): string {
    // Get fromIndentation
    const rawLineInfo = text.split('\n').map(this.lineParts);

    // Infer what the indentation used by the paste is.
    const lineInfosWithWhitespace = rawLineInfo.filter(a => a.whitespacePrefix);
    if (lineInfosWithWhitespace.length === 0) {
      // Doesn't matter if none of the lines are indented
      return '';
    } else if (lineInfosWithWhitespace.some(a => a.whitespacePrefix.includes('\t'))) {
      // If any tabs, then assume tabs
      return '\t';
    } else if (lineInfosWithWhitespace.map(a => whitespaceSubstringCount(a.whitespacePrefix, ' ')).some(spaceCount => spaceCount % 4 === 2)) {
      // Otherwise, determine if two spaces or four
      return '  ';
    } else {
      return '    ';
    }
  }

  private lineParts(line: string) {
    const partsRegex = /^(\s*)(.*)$/;

    // For some reason copying sometimes adds an \r character and pasting that
    // causes an issue in the above regex (removing the '$' works for some
    // reason, but so does removing \r characters and would rather this solution
    // so we don't paste \r in windows copying contexts).
    const match = partsRegex.exec(line.replace(/\r/g, ''))!;
    const whitespacePrefix = match.at(1)!;
    const lineText = match.at(2)!;
    return {
      whitespacePrefix,
      lineText,
    };
  }

  private parse(text: string, fromIndentation: string, firstLinePrefixHasText: boolean): PastableLine[] {

    return text.split("\n").map((line, idx) => {
      if (idx === 0 && firstLinePrefixHasText) {
        return {
          text: line,
          numIndents: 0,
          originalIndentation: "",
        }
      }

      let originalIndentation = "";
      let numIndents = 0;
      while (fromIndentation.length > 0 && line.startsWith(fromIndentation)) {
        numIndents++
        line = line.slice(fromIndentation.length);
        originalIndentation += fromIndentation;
      }

      return {
        text: line,
        numIndents,
        originalIndentation,
      };
    });
  }

  private guessHiddenIndentation(): number {
    if (this.pastableLines.length < 2) {
      return 0;
    }

    const firstLine = this.pastableLines[0];
    const secondLine = this.pastableLines[1];

    const hiddenIndentsIfSameIndentation = secondLine.numIndents - firstLine.numIndents;
    const hiddenIndentsIfSecondLineIndented = secondLine.numIndents - firstLine.numIndents - 1;

    if (hiddenIndentsIfSecondLineIndented < 0) {
      return hiddenIndentsIfSameIndentation;
    }

    // If opening more things than closing, then assume an indent
    const charMap = new Map<string, number>();
    for (const char of firstLine.text) {
      charMap.set(char, (charMap.get(char) || 0) + 1);
    }

    if (((charMap.get("(") || 0) > (charMap.get(")") || 0)) || ((charMap.get("{") || 0) > (charMap.get("}") || 0)) || ((charMap.get("[") || 0) > (charMap.get("]") || 0))) {
      return hiddenIndentsIfSecondLineIndented;
    }

    // Run language specific indent inference
    const languageSpec = guessLanguageSpec();
    if (languageSpec && languageSpec.indentInferred) {
      if (languageSpec.indentInferred(firstLine.text, secondLine.text)) {
        return hiddenIndentsIfSecondLineIndented
      }
    }
    return hiddenIndentsIfSameIndentation;
  }

  async apply(editor: vscode.TextEditor) {
    // Calculate the current editor's whitespace configuration
    const toIndentation = editor.options.insertSpaces ? ' '.repeat(editor.options.indentSize as number) : '\t';
    const fileNumSpaces = (editor.options.insertSpaces ? editor.options.indentSize : editor.options.tabSize) as number;

    return editor.edit(editBuilder => {

      // Iterate over all selections
      for (const sel of editor.selections) {

        // Get the indentation count of the line we're pasting into

        // Get all text in the line behind start of current selection cursor
        const linePrefix = getPrefixText(editor, new vscode.Range(sel.start, sel.end));
        const baseIndentation = /^\s*/.exec(linePrefix)?.at(0)!;

        //
        const nonWhitespacePrefix = /[^\s]/.test(linePrefix);

        const replacement = this.pastableLines.map((pastableLine, idx) => {
          const useOriginalIndentation = idx === 0 && nonWhitespacePrefix;
          return this.applyLine(useOriginalIndentation, pastableLine, idx === 0 ? "" : baseIndentation, fileNumSpaces, toIndentation);
        }).join('\n');

        // Update the document
        editBuilder.delete(sel);
        editBuilder.insert(sel.start, replacement);
      }
    }).then(() => true);
  }

  private applyLine(useOriginalIndentation: boolean, line: PastableLine, baseIndentation: string, fileNumSpaces: number, indentation: string): string {


    if (useOriginalIndentation) {
      return line.originalIndentation + line.text;
    }

    const numIndents = line.numIndents - this.firstLineIndentCount;

    // Simple if adding a non-negative number of indents
    if (numIndents >= 0) {
      return baseIndentation + (indentation.repeat(numIndents)) + line.text;
    }

    this.firstLineIndentCount;

    // Otherwise, we need to chip away indents from baseIndentation
    const spaceIndent = ' '.repeat(fileNumSpaces);
    for (let i = 0; i < -numIndents; i++) {
      if (baseIndentation.endsWith("\t")) {
        baseIndentation = baseIndentation.slice(0, baseIndentation.length - 1); // TODO: just '-1' instead of 'len-1'
      } else if (baseIndentation.endsWith(spaceIndent)) {
        baseIndentation = baseIndentation.slice(0, baseIndentation.length - fileNumSpaces); // TODO: same as above
      } else {
        break;
      }
    }
    return baseIndentation + line.text;
  }
}

function whitespaceSubstringCount(str: string, ws: string): number {
  if (!str || !ws) {
    return 0;
  }

  // TODO: Do this a better way
  let count = 0;
  while (str.startsWith(ws)) {
    count++;
    str = str.slice(0, str.length - ws.length);
  }
  return count
}
