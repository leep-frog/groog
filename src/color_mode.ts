import * as vscode from 'vscode';
import { colorCustomizationSetting } from './settings';

const workbench = "workbench";
const colorCustomizations = "colorCustomizations";

export class ColorMode {
  private activeModes: Map<string, Date>;
  private top?: string;

  constructor() {
    this.activeModes = new Map<string, Date>();
  }

  async add(color?: string) {
    if (!color) {
      return;
    }
    this.activeModes.set(color, new Date());
    console.log(this.activeModes);
    return this.updateColors();
  }

  async remove(color?: string) {
    if (!color) {
      return;
    }
    this.activeModes.delete(color);
    return this.updateColors();
  }

  private async updateColors() {
    const sorted = [...this.activeModes.entries()].sort((a, b) => a[1] < b[1] ? -1 : 1).map(pair => pair[0]);
    const newTop = sorted.pop();

    if (newTop === this.top) {
      return;
    }

    this.top = newTop;
    const newSetting = colorCustomizationSetting(this.top, true);
    newSetting.update();
  }
}
