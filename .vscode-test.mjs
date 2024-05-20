import { defineConfig } from '@vscode/test-cli';
import path from 'path';

export default defineConfig({
	files: 'out/test/**/*.test.js',
  useInstallation: {
    fromMachine: true,
    // This needs to be a different version than the one I'm actually using, otherwise test doesn't run
    fromPath: path.resolve(".vscode-test", "vscode-win32-x64-archive-1.86.0", "Code.exe"),
  },
  workspaceFolder: path.resolve("src", "test", "test-workspace"),
  env: {
    TEST_MODE: true,
  },
  mocha: {
    timeout: 60000,
  },
});
