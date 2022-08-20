import * as vscode from 'vscode';
import { commands } from './commands';
import { Registerable } from './interfaces';
import { Recorder } from './record';

export class Settings implements Registerable {

  private static settings(): Setting[] {
    let ics = [
      "groog.message.info",
      "workbench.action.closePanel",
      "workbench.action.terminal.focusNext",
      "workbench.action.terminal.focusPrevious",
      "workbench.action.terminal.newWithProfile",
    ];
    for (let v of commands.keys()) {
      ics.push("groog." + v);
    }
    return [
      new GlobalSetting("editor", "autoClosingQuotes", "never"),
      new GlobalSetting("editor", "codeActionsOnSave", {
        "source.organizeImports": true,
      }),
      new GlobalSetting("editor", "detectIndentation", false),
      new GlobalSetting("editor", "insertSpaces", true),
      new GlobalSetting("editor", "rulers", [80, 200]),
      new GlobalSetting("editor", "tabSize", 2),
      new GlobalSetting("files", "eol", "\n"),
      new GlobalSetting("files", "insertFinalNewline", true),
      new GlobalSetting("files", "trimFinalNewlines", true),
      new GlobalSetting("files", "trimTrailingWhitespace", true),
      // true is the default, but explicilty set it here to avoid potential issues.
      new GlobalSetting("terminal", "integrated.allowChords", true),
      new GlobalSetting("terminal", "integrated.commandsToSkipShell", ics),
      new GlobalSetting("terminal", "integrated.copyOnSelection", true),
      new GlobalSetting("terminal", "integrated.scrollback", 100_000),
      new GlobalSetting("workbench", "colorCustomizations", {
        "editorGutter.background": "#000000",
        "editorLineNumber.activeForeground": "#00ffff",
        "editor.lineHighlightBackground": "#404040",
      }),
      new GlobalSetting("workbench", "editor.limit.enabled", true),
      new GlobalSetting("workbench", "editor.limit.perEditorGroup", true),
      new GlobalSetting("workbench", "editor.limit.value", 1),
      new GlobalSetting("workbench", "startupEditor", "none"),
      new GlobalSetting("terminal", "integrated.defaultProfile.windows", "MinGW"),
      new GlobalSetting("terminal", "integrated.automationProfile.windows", {
        "path": "C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      }),
      new LanguageSetting("typescript", "editor", "defaultFormatter", "vscode.typescript-language-features"),
      // MinGW terminal
      // https://dev.to/yumetodo/make-the-integrated-shell-of-visual-studio-code-to-bash-of-msys2-5eao
      // https://code.visualstudio.com/docs/terminal/basics#_terminal-profiles
      new GlobalSetting("terminal", "integrated.profiles.windows", {
        // Add the following to settings to make this the default terminal
        // "terminal.integrated.defaultProfile.windows": "MinGW",
        "MinGW": {
          // Follow the instructions in this link to have VS Code open MINGW
          // in the proper directory. Otherwise, will be opened in home directory.
          // https://stackoverflow.com/a/43812298/18162937
          "path": "C:\\msys64\\usr\\bin\\bash.exe",
          "overrideName": true,
          "color": "terminal.ansiGreen",
          // See below link for a list of icons
          // https://code.visualstudio.com/api/references/icons-in-labels
          "icon": "hubot",
          "args": [
            "--login",
            "-i",
          ],
          "env": {
            // See the below link for variables you can use here.
            // https://code.visualstudio.com/docs/editor/variables-reference
            "GROOG_VSCODE": "1",
          },
        },
      }),
    ];
  }

  private static updateSettings(): void {
    for (let s of this.settings()) {
      s.update();
    }
  }

  register(context: vscode.ExtensionContext, recorder: Recorder): void {
    recorder.registerUnrecordableCommand(context, "updateSettings", () => Settings.updateSettings());
  }
}

interface Setting {
  update(): void;
}

class GlobalSetting implements Setting {

  private configSection: string;
  private subsection: string;
  private value: string;

  constructor(configSection: string, subsection: string, value: any) {
    this.configSection = configSection;
    this.subsection = subsection;
    this.value = value;
  }

  update(): void {
    vscode.workspace.getConfiguration(this.configSection).update(this.subsection, this.value, true);
  }
}

class LanguageSetting implements Setting {

  private languageId: string;
  private configSection: string;
  private subsection: string;
  private value: string;

  constructor(languageId: string, configSection: string, subsection: string, value: any) {
    this.languageId = languageId;
    this.configSection = configSection;
    this.subsection = subsection;
    this.value = value;
  }

  update(): void {
    vscode.workspace.getConfiguration(this.configSection, { "languageId": this.languageId }).update(this.subsection, this.value, true, true);
  }
}
