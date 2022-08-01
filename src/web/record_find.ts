/*
- record find
- ctrl+s toggles mode only when recording
- Need way to search for multiple things?? Yes, but in v2 is fine

- ctrl+s starts mode
- enter or ctrl+s searches (record number of searches)
- ctrl+g or moveHandler ends the session (done in record handler)
*/

/*export class RecordFindHandler extends ColorizedHandler implements TypeHandler {
  active: boolean;

  constructor(cm: ColorMode) {
    super(cm);
    this.active = false;
  }

  async colorActivate(): Promise<void> {
    this.active = true;
  }

  async colorDeactivate(): Promise<void> {
    this.active = false;
  }

  modeColor(): Color {
    return new Color(160, 80, 0);
  }

  // Taken care of in record.ts
  async ctrlG(): Promise<void> { }

  async textHandler(s: string): Promise<boolean> {
    return false;
  }

  async delHandler(cmd: string): Promise<boolean> {
    return false;
  }

  // Taken care of in record.ts
  // Actually, this should do everything and just point to
  // the recorder (and vice versa), so whenever this gets deactivated, we just
  // reactivate/unpause the recorder.
  async moveHandler(cmd: string, ...rest: any[]): Promise<boolean> {
    return false;
  }

  register(context: vscode.ExtensionContext, recorder: Recorder): void {

  }

  async onYank(text: string | undefined): Promise<void> {

  }

  async onKill(text: string | undefined): Promise<void> {

  }

  async alwaysOnKill(): Promise<boolean> {
    return false;
  }

  async alwaysOnYank(): Promise<boolean> {
    return false;
  }
}
*/
