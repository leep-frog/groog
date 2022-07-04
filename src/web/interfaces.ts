import * as vscode from 'vscode';
import { Recorder } from './record';

interface Registerable {
  register(context: vscode.ExtensionContext, recorder: Recorder): void;
}

export interface TypeHandler extends Registerable {
  active: boolean;
  activate(): void;
  deactivate(): void;
  ctrlG(): void;

  onYank(text: string | undefined): void
  alwaysOnYank(): boolean
  onKill(text: string | undefined): void
  alwaysOnKill(): boolean

  // Returns whether or not to still send the code
  textHandler(s: string): boolean;
  delHandler(cmd: string): boolean;
  moveHandler(cmd: string, ...rest: any[]): boolean;

  // TODO pasteHandler
  // TODO escape handler (or just same ctrl g?)
}