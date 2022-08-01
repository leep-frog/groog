import * as vscode from 'vscode';

const workbench = "workbench";
const colorCustomizations = "colorCustomizations";

export abstract class ColorizedHandler {
  cm: ColorMode;
  abstract colorActivate(): Thenable<any>;
  abstract colorDeactivate(): Thenable<any>;
  abstract modeColor(): Color;

  constructor(cm: ColorMode) {
    this.cm = cm;
  }

  async activate() {
    await this.colorActivate();
    await this.cm.add(this.modeColor());
  }

  async deactivate() {
    await this.colorDeactivate();
    await this.cm.remove(this.modeColor());
  }
}

// TODO: rather than have each mode set it's color, make one function in here
// that determines it, and each inheriting class passes in a "modeName" string.
// so function can check which modes are active
export class ColorMode {
  r: number;
  g: number;
  b: number;
  colorCodes: Set<string>;

  constructor() {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.colorCodes = new Set<string>();
  }

  async add(color: Color) {
    if (this.colorCodes.has(color.toString())) {
      return;
    }
    this.colorCodes.add(color.toString());
    this.r += color.r;
    this.g += color.g;
    this.b += color.b;
    await this.update();
  }

  async remove(color: Color) {
    if (!this.colorCodes.has(color.toString())) {
      return;
    }
    this.colorCodes.delete(color.toString());
    this.r -= color.r;
    this.g -= color.g;
    this.b -= color.b;
    await this.update();
  }

  private async update() {
    if (this.colorCodes.size === 0) {
      await this.setP(undefined);
    } else {
      this.setP(new Color(
        this.r / this.colorCodes.size,
        this.g / this.colorCodes.size,
        this.b / this.colorCodes.size,
      ));
    }
  }

  private async setP(c: Color | undefined) {
    await Color.setProperty("titleBar.activeBackground", c);
  }
}

export class Color {
  r: number;
  g: number;
  b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }

  public static async setProperty(property: string, color: Color | undefined) {
    let wb = vscode.workspace.getConfiguration(workbench);
    let cc: Record<string, string | undefined> | undefined = wb.get(colorCustomizations);
    if (!cc) {
      cc = {};
    }
    if (color) {
      // Set the property's color.
      cc[property] = color.toString();
    } else if (!cc[property]) {
      // No need to remove a property that doesn't exist.
      return;
    } else {
      // Remove the property
      cc[property] = undefined;
      // This causes an error, hence why we need to set the value to undefined.
      // delete cc[property];
    }

    // getConfiguration gets the merged settings so if getConfiguration seems to
    // be returning weird things, it's probably becuase a workspace-level setting
    // is also being set. See the below link for more details:
    // https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
    await wb.update(colorCustomizations, cc, true);
  }

  private prepend(c: string): string {
    return "0".repeat(Math.max(0, 2 - c.length)) + c;
  }

  public toString(): string {
    return `#${this.prepend(this.r.toString(16))}${this.prepend(this.g.toString(16))}${this.prepend(this.b.toString(16))}`;
  }

  public static average(...colors: Color[]): Color | undefined {
    if (colors.length === 0) {
      return undefined;
    }

    let r = 0;
    let g = 0;
    let b = 0;
    for (var c of colors) {
      r += c.r;
      g += c.g;
      b += c.b;
    }
    r /= colors.length;
    g /= colors.length;
    b /= colors.length;
    return new Color(r, g, b);
  }
}
