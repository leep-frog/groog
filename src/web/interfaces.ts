import * as vscode from 'vscode';
import { Recorder } from './record';

export interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

export interface TypeHandler extends Registerable {
  active: boolean;
  activate(): Thenable<void>;
  deactivate(): Thenable<void>;
  ctrlG(): Thenable<void>;

  onYank(text: string | undefined): Thenable<void>
  alwaysOnYank(): Thenable<boolean>
  onKill(text: string | undefined): Thenable<void>
  alwaysOnKill(): Thenable<boolean>

  // Returns whether or not to still send the code
  textHandler(s: string): Thenable<boolean>;
  delHandler(cmd: string): Thenable<boolean>;
  moveHandler(cmd: string, ...rest: any[]): Thenable<boolean>;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
}
