
// This file contains external (ie used in settings.json) facing

// Words is a map from typo to corrected spelling.
export interface Words {
  [key: string]: string;
}

export interface Correction {
  // The list of languages for which this correction applies.
  // If not provided, then the correction is applied for all languages.
  languages?: string[];
  // Map of all corrections.
  words: Words;
  // Break characters that apply for these corrections. If undefined, then
  // default break characters are used.
  breakCharacters?: string;
  // Words to add after the replacement, but before the cursor.
  replacementSuffix?: string;
  // Words to add after the replacement and after the cursor.
  replacementSuffixAfterCursor?: string;
  excludeBreakCharacter?: boolean;
}

// See the below link for vscode language codes:
// https://code.visualstudio.com/docs/languages/identifiers
const goLanguageKey = "go";
const jsoncLanguageKey = "jsonc";
const jsonLanguageKey = "json";
const typescriptLanguageKey = "typescript";

export function defaultCorrections(): Correction[] {
  return [
    {
      languages: [
        typescriptLanguageKey,
      ],
      words: {
        "si": "vscode.window.showInformationMessage",
        "se": "vscode.window.showInformationMessage",
      },
      replacementSuffix: "(\"",
      replacementSuffixAfterCursor: "\");",
      excludeBreakCharacter: true,
    },
    // Println replacements (no quotes in suffix fields)
    {
      languages: [
        goLanguageKey,
      ],
      words: {
        "fpl": "fmt.Println",
        "spl": "fmt.Sprintln",
        "ool": "o.Stdoutln",
        "oel": "o.Stderrln",
      },
      replacementSuffix: "(",
      replacementSuffixAfterCursor: ")",
      excludeBreakCharacter: true,
    },
    // Printf and regex replacements (quotes in suffix fields)
    {
      languages: [
        goLanguageKey,
      ],
      words: {
        "fpf": "fmt.Printf",
        "spf": "fmt.Sprintf",
        "oof": "o.Stdoutf",
        "oef": "o.Stderrf",
        "rx": "rgx.New",
      },
      replacementSuffix: "(\"",
      replacementSuffixAfterCursor: "\")",
      excludeBreakCharacter: true,
    },
    // Regex pattern shortcuts
    {
      languages: [
        goLanguageKey,
      ],
      words: {
        "rxn": "([1-9][0-9]*)",
        "rxw": "([a-zA-Z]+)",
      },
      excludeBreakCharacter: true,
    },
  ];
}
