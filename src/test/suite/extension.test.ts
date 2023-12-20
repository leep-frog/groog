import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { Document } from '../../find';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

interface DocumentTest {
  name: string;
  document: string[];
  queryText: string;
  caseInsensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  want: vscode.Range[];
}

const documentTestCases: DocumentTest[] = [
  {
    name: "empty string search",
    document: [
      "one two three",
    ],
    queryText: "",
    want: [],
  },
  {
    name: "Literal string search",
    document: [
      "one two three",
    ],
    queryText: "two",
    want: [
      new vscode.Range(
        new vscode.Position(1, 5),
        new vscode.Position(1, 8),
      ),
    ],
  },
  {
    name: "Literal string search requires case match",
    document: [
      "one two three",
    ],
    queryText: "Two",
    want: [],
  },
  {
    name: "Literal string search - no match",
    document: [
      "one two three",
    ],
    queryText: "four",
    want: [],
  },
  {
    name: "Literal string search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "e ",
    want: [
      new vscode.Range(
        new vscode.Position(1, 3),
        new vscode.Position(1, 5),
      ),
      new vscode.Range(
        new vscode.Position(1, 13),
        new vscode.Position(1, 15),
      ),
      new vscode.Range(
        new vscode.Position(1, 23),
        new vscode.Position(1, 25),
      ),
    ],
  },
  {
    name: "Literal string search with overlapping matches",
    document: [
      " abc abc abc abc abc ",
    ],
    queryText: " abc abc ",
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(1, 10),
      ),
      new vscode.Range(
        new vscode.Position(1, 13),
        new vscode.Position(1, 22),
      ),
    ],
  },
  // Match case tests
  {
    name: "Literal string search case insensitive",
    document: [
      "one two three",
    ],
    caseInsensitive: true,
    queryText: "TWO",
    want: [
      new vscode.Range(
        new vscode.Position(1, 5),
        new vscode.Position(1, 8),
      ),
    ],
  },
  {
    name: "Literal string search with multiple matches",
    document: [
      "one two THREE four five six seven",
    ],
    caseInsensitive: true,
    queryText: "e ",
    want: [
      new vscode.Range(
        new vscode.Position(1, 3),
        new vscode.Position(1, 5),
      ),
      new vscode.Range(
        new vscode.Position(1, 13),
        new vscode.Position(1, 15),
      ),
      new vscode.Range(
        new vscode.Position(1, 23),
        new vscode.Position(1, 25),
      ),
    ],
  },
  // Regex tests
  {
    name: "regex search",
    document: [
      "one two three",
    ],
    queryText: "[vwxyz]",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 6),
        new vscode.Position(1, 7),
      ),
    ],
  },
  {
    name: "regex search requires case",
    document: [
      "one tWo three woW",
    ],
    queryText: "[vwxyz]",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 15),
        new vscode.Position(1, 16),
      ),
    ],
  },
  {
    name: "regex search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "o.. ",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(1, 5),
      ),
      new vscode.Range(
        new vscode.Position(1, 16),
        new vscode.Position(1, 20),
      ),
    ],
  },
  // Regex and case tests
  {
    name: "regex search",
    document: [
      "one two three",
    ],
    queryText: "[vwxyz]",
    caseInsensitive: true,
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 6),
        new vscode.Position(1, 7),
      ),
    ],
  },
  {
    name: "regex search with multiple matches",
    document: [
      "one two three four five six seven",
    ],
    queryText: "o.. ",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(1, 5),
      ),
      new vscode.Range(
        new vscode.Position(1, 16),
        new vscode.Position(1, 20),
      ),
    ],
  },
  // Regex and newline character
  {
    name: "regex .* doesn't catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "o.*",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(1, 4),
      ),
      new vscode.Range(
        new vscode.Position(2, 3),
        new vscode.Position(2, 4),
      ),
      new vscode.Range(
        new vscode.Position(4, 3),
        new vscode.Position(4, 4),
      ),
      new vscode.Range(
        new vscode.Position(5, 1),
        new vscode.Position(5, 4),
      ),
    ],
  },
  {
    name: "regex with \n does catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "o.*\nt.+\nth",
    regex: true,
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(3, 3),
      ),
    ],
  },
  {
    name: "non-regex with \n does catch newline character",
    document: [
      "one",
      "two",
      "three",
      "two",
      "one",
    ],
    queryText: "one\ntwo\nth",
    want: [
      new vscode.Range(
        new vscode.Position(1, 1),
        new vscode.Position(3, 3),
      ),
    ],
  },
  // Whole word match (TODO)
  /* Useful for commenting out tests. */
];

suite('Document.matches Test Suite', () => {
  documentTestCases.forEach(dtc => {
    test(dtc.name, () => {
      // const doc = new Document(dtc.document.join("\n"));
      // const got = doc.matches(dtc.queryText, !!dtc.caseInsensitive, !!dtc.regex, !!dtc.wholeWord);
      // assert.deepStrictEqual(got, dtc.want);
    });
  });
});
