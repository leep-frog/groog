/*
- record find
- ctrl+s toggles mode only when recording
- Need way to search for multiple things?? Yes, but in v2 is fine

- ctrl+s starts mode
- enter or ctrl+s searches (record number of searches)
- ctrl+g or moveHandler ends the session (done in record handler)
*/

import * as vscode from 'vscode';
import { Recorder } from './record';
import { TypeHandler } from './interfaces';

export class RecordFindHandler implements TypeHandler {
  active: boolean;

  constructor() {
    this.active = false;
  }

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  // Taken care of in record.ts
  ctrlG(): void { }

  textHandler(s: string): boolean {
    return false;
  }

  delHandler(cmd: string): boolean {
    return false;
  }

  // Taken care of in record.ts
  // Actually, this should do everything and just point to
  // the recorder (and vice versa), so whenever this gets deactivated, we just
  // reactivate/unpause the recorder.
  moveHandler(cmd: string, ...rest: any[]): boolean {
    return false;
  }

  register(context: vscode.ExtensionContext, recorder: Recorder): void {
    
  }

  onYank(text: string | undefined): void {
    
  }

  onKill(text: string | undefined): void {
    
  }

  alwaysOnKill(): boolean {
    return false;
  }

  alwaysOnYank(): boolean {
    return false;
  }
}