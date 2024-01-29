import * as vscode from 'vscode';
import { ColorMode } from './color_mode';

import { CursorMove, DeleteCommand, setGroogContext } from "./interfaces";
import { Recorder } from "./record";
import { GroogSetting, colorCustomizationSetting } from './settings';

export interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export abstract class TypeHandler implements Registerable {
  private active: boolean;
  private cm: ColorMode;
  abstract readonly whenContext : string;
  private readonly color? : string;

  constructor(cm: ColorMode, color?: string) {
    this.active = false;
    this.cm = cm;
    this.color = color;
  }

  isActive() : boolean {
    return this.active;
  }

  // Needed for Registerable interface
  abstract register(context: vscode.ExtensionContext, recorder: Recorder): void;

  // Any handler-specific logic that should run on activation.
  abstract handleActivation() : Promise<void>;
  // Any handler-specific logic that should run on deactivation.
  abstract handleDeactivation() : Promise<void>;

  // Returns whether or not it was actually activated
  async activate() {
    if (!this.active) {
      this.active = true;
      await this.handleActivation();

      // Update when clause context
      await setGroogContext(this.whenContext, true);

      await this.cm.add(this.color);
    }
  }

  // Returns whether or not it was actually deactivated
  async deactivate() {
    if (this.active) {
      this.active = false;

      await this.handleDeactivation();

      // Update when clause context
      await setGroogContext(this.whenContext, false);

      // Update color if relevant
      await this.cm.remove(this.color);
    }
  }

  // ctrlG should return true if ctrlG commands should still be run; false otherwise.
  abstract ctrlG(): Thenable<boolean>;

  // onPaste should return false if the handler took care of the paste action.
  // This will only be run if the handler is active.
  abstract onPaste(text: string): Thenable<boolean>;

  // onEmacsPaste should return false if the handler took care of the emacs paste action.
  // This will only be run if the handler is active.
  abstract onEmacsPaste(text: string): Thenable<boolean>;

  abstract onYank(prefixText: string | undefined, text: string | undefined): Thenable<void>;
  abstract alwaysOnYank: boolean;
  abstract onKill(text: string | undefined): Thenable<void>;
  abstract alwaysOnKill: boolean;

  // Returns whether or not to still send the code
  abstract textHandler(s: string): Thenable<boolean>;
  abstract delHandler(cmd: DeleteCommand): Thenable<boolean>;
  abstract moveHandler(cmd: CursorMove, ...rest: any[]): Thenable<boolean>;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
}

export function getPrefixText(editor: vscode.TextEditor | undefined, range: vscode.Range) : string | undefined {
  const preRange = new vscode.Range(range.start.line, 0, range.start.line, range.start.character);
  return editor?.document.getText(preRange);
}
