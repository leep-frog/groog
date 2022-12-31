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
		cc("groog.fall", "Emacs Fall"),
		cc("groog.find", "Groog find"),
		cc("groog.find.toggleReplaceMode", "Groog toggle between find and replace input boxes"),
		cc("groog.find.previous", "Groog go to previous find context"),
		cc("groog.find.next", "Groog go to next find context"),
		cc("groog.format", "Groog format"),
		cc("groog.jump", "Emacs Jump"),
		cc("groog.kill", "Emacs Kill Line"),
		cc("groog.message.info", "Groog Info Message"),
		cc("groog.multiCommand.execute", "Groog MultiCommand"),
		cc("groog.paste", "Emacs Paste"),
		cc("groog.record.endRecording", "Groog End Recording"),
		cc("groog.record.find", "Find selection during recording"),
		cc("groog.record.findNext", "Find the next selection during recording"),
		cc("groog.record.playNamedRecording", "Groog Play Named Recording..."),
		cc("groog.record.playRecording", "Groog Play Recording"),
		cc("groog.record.deleteRecording", "Groog Delete Recording"),
		cc("groog.record.saveRecordingAs", "Groog Save Recording As..."),
		cc("groog.record.startRecording", "Groog Start Recording"),
		cc("groog.reverseFind", "Groog reverse find"),
		cc("groog.toggleMarkMode", "Emacs Toggle Mark Mode"),
		cc("groog.toggleQMK", "Emacs Toggle QMK"),
		cc("groog.type", "Groog Type"),
		cc("groog.undo", "Undo"),
		cc("groog.updateSettings", "Groog update settings"),
		cc("groog.yank", "Emacs Yank"),
	}
)
