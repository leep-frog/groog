import { defineConfig } from '@vscode/test-cli';
import path from 'path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
  // download: {
    // timeout: 123,
  // },
  // dow
  useInstallation: {
    fromMachine: true,
    fromPath: path.resolve(".vscode-test", "vscode-win32-x64-archive-1.87.0", "Code.exe"),
    // fromPath: path.resolve(__dirname, ".//"),
  },

});
