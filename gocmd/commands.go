package main

import (
	"fmt"
)

type Command struct {
	Command string `json:"command"`
	Title   string `json:"title"`
}

func (cc *Command) activationEvent() string {
	return fmt.Sprintf("onCommand:%s", cc.Command)
}

func cc(command string, title string) *Command {
	return &Command{command, title}
}

var (
	CustomCommands = []*Command{
		cc("groog.copyImport", "Copy import line for the file"),
		cc("groog.cursorBottom", "Emacs Cursor Bottom"),
		cc("groog.cursorDown", "Emacs Cursor Down"),
		cc("groog.cursorEnd", "Emacs Cursor End"),
		cc("groog.cursorHome", "Emacs Cursor Home"),
		cc("groog.cursorLeft", "Emacs Cursor Left"),
		cc("groog.cursorRight", "Emacs Cursor Right"),
		cc("groog.cursorTop", "Emacs Cursor Top"),
		cc("groog.cursorUp", "Emacs Cursor Up"),
		cc("groog.cursorWordRight", "Emacs Cursor Word Right"),
		cc("groog.cursorWordLeft", "Emacs Cursor Word Left"),
		cc("groog.ctrlG", "Emacs Ctrl-G"),
		cc("groog.deleteLeft", "Groog delete left"),
		// TODO double check this doesn't work (same for deleteRight and other delete commands)
		/*{
			Key: "ctrl+h",
			Command: "deleteLeft",
			When: "inQuickOpen",
		},
		{
			Key: "backspace",
			Command: "deleteLeft",
			When: "inQuickOpen",
		},
		*/
		cc("groog.deleteRight", "Groog delete right"),
		cc("groog.deleteWordLeft", "Groog delete left"),
		cc("groog.deleteWordRight", "Groog delete right"),
		cc("groog.focusNextEditor", "Focus next editor"),
		cc("groog.focusPreviousEditor", "Focus next editor"),
		cc("groog.fall", "Emacs Fall"),
		cc("groog.find", "Groog find"),
		cc("groog.find.toggleReplaceMode", "Groog toggle between find and replace input boxes"),
		cc("groog.find.toggleRegex", "Groog toggle regex"),
		cc("groog.find.toggleCase", "Groog toggle case"),
		cc("groog.find.toggleWholeWord", "Groog toggle whole word"),
		cc("groog.find.previous", "Groog go to previous find context"),
		cc("groog.find.next", "Groog go to next find context"),
		cc("groog.find.replaceOne", "Replace single match"),
		cc("groog.find.replaceAll", "Replace all matches"),
		cc("groog.format", "Groog format"),
		cc("groog.indentToPreviousLine", "Indent to match previous line"),
		cc("groog.indentToNextLine", "Indent to match next line"),
		cc("groog.jump", "Emacs Jump"),
		cc("groog.kill", "Emacs Kill Line"),
		cc("groog.maim", "Emacs Kill Line (copy only)"),
		cc("groog.message.info", "Groog Info Message"),
		cc("groog.multiCommand.execute", "Groog MultiCommand"),
		cc("groog.emacsPaste", "Emacs Paste"),
		cc("groog.paste", "Groog Paste"),
		cc("groog.record.endRecording", "Groog End Recording"),
		cc("groog.record.playNamedRecording", "Groog Play Named Recording..."),
		cc("groog.record.playRecording", "Groog Play Recording"),
		cc("groog.record.playRecordingRepeatedly", "Groog Play Recording Repeatedly"),
		cc("groog.record.deleteRecording", "Groog Delete Recording"),
		cc("groog.record.saveRecordingAs", "Groog Save Recording As..."),
		cc("groog.record.startRecording", "Groog Start Recording"),
		cc("groog.renameFile", "Groog Rename File"),
		cc("groog.copyFilename", "Groog Copy Filename"),
		cc("groog.reverseFind", "Groog reverse find"),
		cc("groog.terminal.find", "Groog find in terminal"),
		cc("groog.terminal.reverseFind", "Groog find in terminal"),
		cc("groog.toggleMarkMode", "Emacs Toggle Mark Mode"),
		cc("groog.toggleQMK", "Emacs Toggle QMK"),
		cc("groog.trimClipboard", "Groog Trim Clipboard"),
		cc("groog.type", "Groog Type"),
		cc("groog.undo", "Groog Undo"),
		cc("groog.redo", "Groog Redo"),
		cc("groog.updateSettings", "Groog update settings"),
		cc("groog.yank", "Emacs Yank"),
		cc("groog.tug", "Emacs Yank (copy only)"),
		cc("groog.testReset", "Reset test setup"),
		cc("groog.work.copyLink", "Copy work link for file"),

		cc("groog.script.replaceNewlineStringsWithQuotes", "Groog Script: Replace Newline Strings with Quotes"),
		cc("groog.script.replaceNewlineStringsWithTicks", "Groog Script: Replace Newline Strings with Ticks"),
	}
)
