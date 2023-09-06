import * as vscode from 'vscode';

const workbench = "workbench";
const colorCustomizations = "colorCustomizations";

export enum ModeColor {
  find,
  record,
  mark,
}

export class ColorMode {
  activeModes: Set<ModeColor>;

  constructor() {
    this.activeModes = new Set<ModeColor>();
  }

  async add(m: ModeColor) {
    // TODO: Updating settings is too slow. Make this
    // work via a web view?
    return;
    if (this.activeModes.has(m)) {
      return;
    }
    this.activeModes.add(m);
    this.updateColors();
  }

  async remove(m: ModeColor) {
    return;
    if (!this.activeModes.has(m)) {
      return;
    }
    this.activeModes.delete(m);
    this.updateColors();
  }

  private async updateColors() {
    let find = this.activeModes.has(ModeColor.find);
    let rec = this.activeModes.has(ModeColor.record);
    let mark = this.activeModes.has(ModeColor.mark);
    let c: Color | undefined;
    if (rec && mark) {
      c = new Color(250, 0, 250);
    } else if (find) {
      c = new Color(220, 220, 0);
    } else if (rec) {
      c = new Color(190, 0, 0);
    } else if (mark) {
      c = new Color(0, 0, 160);
    }
    await this.setP(c);
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
