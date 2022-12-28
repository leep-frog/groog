import * as vscode from 'vscode';
import { ColorMode, ModeColor } from './color_mode';

import { CursorMove, DeleteCommand, setGroogContext } from "./interfaces";
import { Recorder } from "./record";

export interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

export abstract class TypeHandler implements Registerable {
  private active: boolean;
  cm: ColorMode;
  mc?: ModeColor;
  abstract whenContext : string;

  constructor(cm: ColorMode, mc?: ModeColor) {
    this.active = false;
    this.cm = cm;
    this.mc = mc;
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
      await this.handleActivation();

      // Update when clause context
      await setGroogContext(this.whenContext, true);

      // Update color if relevant
      if (this.mc !== undefined) {
        this.cm.add(this.mc);
      }

      this.active = true;
    }
  }

  // Returns whether or not it was actually deactivated
  async deactivate() {
    if (this.active) {
      await this.handleDeactivation();

      // Update when clause context
      await setGroogContext(this.whenContext, false);

      // Update color if relevant
      if (this.mc !== undefined) {
        this.cm.remove(this.mc);
      }

      this.active = false;
    }
  }

  abstract ctrlG(): Thenable<void>;

  abstract onYank(text: string | undefined): Thenable<void>;
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
