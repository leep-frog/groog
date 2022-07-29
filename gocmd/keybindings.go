package main

import (
	"fmt"
	"regexp"

	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
)

const (
	up        = "up"
	down      = "down"
	left      = "left"
	right     = "right"
	pageup    = "pageup"
	pagedown  = "pagedown"
	backspace = "backspace"
	delete    = "delete"
	home      = "home"
	end       = "end"
	insert    = "insert"
	tab       = "tab"
	enter     = "enter"
	always    = ""

	terminalFocus = "terminalFocus"
)

func kbDefsToBindings() []*Keybinding {
	keys := maps.Keys(kbDefinitions)
	slices.Sort(keys)

	var kbs []*Keybinding
	for _, key := range keys {
		m := kbDefinitions[key]
		whens := maps.Keys(m)
		slices.Sort(whens)

		for _, when := range whens {
			kb := m[when]
			if kb == nil {
				continue
			}
			// TODO: ctrl x doubler
			kbs = append(kbs, &Keybinding{
				Key:     key.ToString(),
				When:    when,
				Command: kb.Command,
				Args:    kb.Args,
			})
		}
	}
	return kbs
}

var (
	// Map from key to "when context" to command to run in that context
	kbDefinitions = map[Key]map[string]*KB{
		// TODO: when maps should be sorted to ensure consistent behavior.

		ctrlX("o"): only("workbench.action.openRecent"),
		shift(pageup): {
			"editorFocus": kb("editor.action.selectHighlights"),
		},
		// Really want to make sure we want to kill a terminal
		// so we notify on ctrl+q and actually delete on ctrl+shift+q.
		ctrlX("q"): only("workbench.action.toggleSidebarVisibility"),
		ctrl("q"): terminalSplit(
			notification("Run ctrl+shift+q to kill the terminal"),
			kb("workbench.action.closeEditorsAndGroup"),
		),
		ctrl(shift("q")): terminalSplit(kb("workbench.action.terminal.kill"), nil),
		ctrlX("z"):       only("workbench.action.togglePanel"),
		ctrlX("t"):       only("groog.toggleQMK"),
		ctrl("r"):        only("groog.reverseFind"),
		ctrl("s"): {
			"!groog.qmk && !groog.recording": kb("groog.find"),
			"groog.qmk":                      kb("groog.cursorRight"),
			"!groog.qmk && groog.recording":  kb("groog.record.findNext"),
		},
		ctrl("f"): {
			"groog.qmk && !groog.recording": kb("groog.find"),
			"!groog.qmk":                    kb("groog.cursorRight"),
			"groog.qmk && groog.recording":  kb("groog.record.findNext"),
		},
		ctrl("w"): only("groog.yank"),
		ctrl("j"): only("groog.toggleMarkMode"),
		ctrl("y"): only("groog.paste"),
		ctrl("k"): only("groog.kill"),
		ctrl("l"): only("groog.jump"),
		pageup:    only("groog.jump"),
		ctrl("v"): only("groog.fall"),
		pagedown:  only("groog.fall"),
		ctrl("p"): {
			always: kb("-workbench.action.quickOpen"),
			"editorTextFocus && !suggestWidgetVisible": kb("groog.cursorUp"),
			"editorTextFocus && suggestWidgetVisible":  kb("selectPrevSuggestion"),
			"inQuickOpen":    kb("workbench.action.quickOpenNavigatePreviousInFilePicker"),
			"groog.findMode": kb("editor.action.previousMatchFindAction"),
		},
		up: {
			"editorTextFocus && !suggestWidgetVisible": kb("groog.cursorUp"),
			"editorTextFocus && suggestWidgetVisible":  kb("selectPrevSuggestion"),
			"inQuickOpen": kb("workbench.action.quickOpenNavigatePreviousInFilePicker"),
		},
		ctrl("n"): {
			always: kb("-workbench.action.files.newUntitledFile"),
			"editorTextFocus && !suggestWidgetVisible": kb("groog.cursorDown"),
			"editorTextFocus && suggestWidgetVisible":  kb("selectNextSuggestion"),
			"inQuickOpen":    kb("workbench.action.quickOpenNavigateNextInFilePicker"),
			"groog.findMode": kb("editor.action.nextMatchFindAction"),
		},
		down: {
			"editorTextFocus && !suggestWidgetVisible": kb("groog.cursorDown"),
			"editorTextFocus && suggestWidgetVisible":  kb("selectNextSuggestion"),
			"inQuickOpen": kb("workbench.action.quickOpenNavigateNextInFilePicker"),
		},
		left:      only("groog.cursorLeft"),
		ctrl("b"): only("groog.cursorLeft"),
		right:     only("groog.cursorRight"),
		home:      only("groog.cursorHome"),
		// TODO: groog.qmk funciton (or use generic one like in other todo)
		ctrl("a"):         keyboardSplit(kb("groog.cursorHome"), kb("editor.action.selectAll")),
		ctrl(shift("a")):  only("editor.action.selectAll"),
		ctrl(shift(home)): only("editor.action.selectAll"),
		shift(home):       only("editor.action.selectAll"),
		end:               only("groog.cursorEnd"),
		ctrl("e"):         only("groog.cursorEnd"),
		alt("f"):          only("groog.cursorWordRight"),
		alt("s"):          only("editor.action.startFindReplaceAction"),
		ctrl(right):       only("groog.cursorWordRight"),
		alt("b"):          only("groog.cursorWordLeft"),
		ctrl(left):        only("groog.cursorWordLeft"),
		ctrlX("p"):        only("groog.cursorTop"),
		ctrlX("n"):        terminalSplit(kb("workbench.action.terminal.rename"), kb("groog.cursorBottom")),
		ctrl("g"): {
			"!sideBarFocus && !inQuickOpen && !suggestWidgetVisible": kb("groog.ctrlG"),
			"sideBarFocus && !inQuickOpen && !suggestWidgetVisible":  kb("workbench.action.focusActiveEditorGroup"),
			"inQuickOpen && !suggestWidgetVisible":                   kb("workbench.action.closeQuickOpen"),
			"suggestWidgetVisible":                                   kb("hideSuggestWidget"),
		},
		ctrl("/"):  terminalSplit(nil, kb("groog.undo")),
		ctrlX("x"): only("groog.record.startRecording"),
		ctrlX("s"): only("workbench.action.files.save"),
		ctrlX("f"): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.quickOpen",
			),
			kb("workbench.action.quickOpen"),
		),
		alt("e"): recordingSplit(
			kb("groog.record.endRecording"),
			kb("groog.record.playRecording"),
		),
		alt(shift("e")): recordingSplit(
			kb("groog.record.saveRecordingAs"),
			kb("groog.record.playNamedRecording"),
		),
		ctrl(shift("s")): {
			"!groog.qmk && groog.recording":  kb("groog.record.find"),
			"!groog.qmk && !groog.recording": kb("workbench.action.findInFiles"),
		},
		ctrl(shift("f")): {
			"groog.qmk && groog.recording":  kb("groog.record.find"),
			"groog.qmk && !groog.recording": kb("workbench.action.findInFiles"),
		},
		shift(enter): {
			"groog.findMode": kb("editor.action.previousMatchFindAction"),
		},
		enter: {
			"groog.findMode": kb("editor.action.nextMatchFindAction"),
		},
		// Sometimes hit alt+g on qmk keyboard. This binding
		// ensures we don't change focus to the menu bar (File, Edit, ...).
		alt("g"):        only("noop"),
		ctrl("h"):       only("groog.deleteLeft"),
		backspace:       only("groog.deleteLeft"),
		ctrl("d"):       only("groog.deleteRight"),
		delete:          only("groog.deleteRight"),
		alt("h"):        only("groog.deleteWordLeft"),
		alt(backspace):  only("groog.deleteWordLeft"),
		ctrl(backspace): only("groog.deleteWordLeft"),
		alt("d"):        only("groog.deleteWordRight"),
		alt(delete):     only("groog.deleteWordRight"),
		ctrl(delete):    only("groog.deleteWordRight"),
		ctrlX(tab):      only("groog.format"),
		ctrlX("y"):      only("editor.action.clipboardPasteAction"),
		// This might need to change to ctrl+x shift+insert (currently this attaches ctrl to latter key hit).
		ctrlX(string(insert)): only("editor.action.clipboardPasteAction"),
		alt("y"):              only("editor.action.clipboardPasteAction"),
		// ctrl+x ctrl+y on qmk keyboard
		ctrl("x shift+insert"): only("editor.action.clipboardPasteAction"),
		ctrlX("r"):             only("workbench.action.reloadWindow"),
		// find keybindings
		alt("r"): only("toggleSearchEditorRegex"),
		alt("c"): only("toggleSearchEditorCaseSensitive"),
		alt("f4"): {
			"groog.qmk && editorFocus":                                            kb("toggleFindWholeWord"),
			"groog.qmk && inSearchEditor":                                         kb("toggleSearchEditorWholeWord"),
			"groog.qmk && searchViewletFocus":                                     kb("toggleSearchWholeWord"),
			"groog.qmk && !editorFocus && !inSearchEditor && !searchViewletFocus": kb("toggleSearchWholeWord"),
		},
		// Settings
		ctrl("."): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openGlobalKeybindings",
			),
			kb("workbench.action.openGlobalKeybindings"),
		),
		ctrlX("."): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openGlobalKeybindingsFile",
			),
			kb("workbench.action.openGlobalKeybindingsFile"),
		),
		ctrl(","): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openSettings",
			),
			kb("workbench.action.openSettings"),
		),
		ctrlX(","): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openSettingsJson",
			),
			kb("workbench.action.openSettingsJson"),
		),
		// Emacs
		alt("x"):   only("workbench.action.showCommands"),
		ctrlX("l"): only("workbench.action.gotoLine"),
		ctrlX("v"): onlyMC(
			"workbench.action.splitEditorDown",
			"workbench.action.focusPreviousGroup",
		),
		ctrlX("h"): onlyMC(
			"workbench.action.splitEditorRight",
			"workbench.action.focusPreviousGroup",
		),
		ctrl(";"): only("editor.action.commentLine"),
		// Markdown
		ctrlX("m"): {
			"editorLangId == 'markdown'": kb("markdown.showPreviewToSide"),
		},
		// Git
		alt("z"):   only("git.revertSelectedRanges"),
		alt("p"):   only("workbench.action.editor.previousChange"),
		alt("n"):   only("workbench.action.editor.nextChange"),
		ctrlX("d"): only("editor.action.revealDefinition"),
		// Terminal
		ctrl("t"): panelSplit(
			kb("workbench.action.closePanel"),
			kb("workbench.action.toggleMaximizedPanel"),
		),
		ctrl("u"): terminalSplit(
			kb("workbench.action.terminal.focusPrevious"),
			kb("workbench.action.focusPreviousGroup"),
		),
		ctrl("o"): terminalSplit(
			kb("workbench.action.terminal.focusNext"),
			kb("workbench.action.focusNextGroup"),
		),
		ctrl(shift(tab)): terminalSplit(
			kb("workbench.action.terminal.focusPrevious"),
			kb("workbench.action.focusPreviousGroup"),
		),
		ctrl(tab): terminalSplit(
			kb("workbench.action.terminal.focusNext"),
			kb("workbench.action.focusNextGroup"),
		),
		ctrl(pagedown):   only("workbench.action.focusNextGroup"),
		ctrl(pageup):     only("workbench.action.focusPreviousGroup"),
		ctrl(shift("n")): only("workbench.action.files.newUntitledFile"),
		ctrl("i"):        only("editor.action.formatSelection"),
		ctrl(shift("t")): only("workbench.action.terminal.new"),
		alt(shift("t")):  only("workbench.action.terminal.newWithProfile"),
		// Ctrl+x ctrl+c isn't send to terminal directly, so we need to
		// explicitly send the sequence.
		// See below link for unicode characters:
		// https://en.wikipedia.org/wiki/List_of_Unicode_characters
		ctrlX("c"): terminalSplit(sendSequence("\u0018\u0003"), nil),
		// Go
		alt("t"): only("go.test.package"),
	}
)

type KB struct {
	Command string
	Args    map[string]interface{}
}

func only(command string) map[string]*KB {
	return onlyArgs(command, nil)
}

func onlyArgs(command string, args map[string]interface{}) map[string]*KB {
	return map[string]*KB{
		always: kbArgs(command, args),
	}
}

func kb(cmd string) *KB {
	return kbArgs(cmd, nil)
}

// TODO: combine this with mc
func onlyMC(cmds ...string) map[string]*KB {
	return onlyArgs("groog.multiCommand.execute", map[string]interface{}{
		"sequence": cmds,
	})
}

func notification(message string) *KB {
	return kbArgs("groog.message.info", map[string]interface{}{
		"message": message,
	})
}

func mc(cmds ...string) *KB {
	return kbArgs("groog.multiCommand.execute", map[string]interface{}{
		"sequence": cmds,
	})
}

func sendSequence(text string) *KB {
	return kbArgs("workbench.action.terminal.sendSequence", map[string]interface{}{
		"text": text,
	})
}

func kbArgs(cmd string, args map[string]interface{}) *KB {
	return &KB{
		Command: cmd,
		Args:    args,
	}
}

type Key string

func (k Key) ToString() string {
	return string(k)
}

func alt(c Key) Key {
	return Key(fmt.Sprintf("alt+%s", c))
}

func ctrl(c Key) Key {
	return Key(fmt.Sprintf("ctrl+%s", c))
}

func shift(c Key) Key {
	return Key(fmt.Sprintf("shift+%s", c))
}

var (
	simpleContextRegex = regexp.MustCompile(`^[a-zA-Z\.]+$`)
)

// contextualKB will run the trueKB if contextKey is set
// and falseKB otherwise. An error is returned if `contextKey` is not
// a single variable.
func contextualKB(contextKey string, trueKB, falseKB *KB) map[string]*KB {
	if !simpleContextRegex.MatchString(contextKey) {
		panic(fmt.Sprintf("context key (%q) does not match required regexp (%s)", contextKey, simpleContextRegex))
	}
	return map[string]*KB{
		contextKey:                     trueKB,
		fmt.Sprintf("!%s", contextKey): falseKB,
	}
}

func keyboardSplit(basicKB, qmkKB *KB) map[string]*KB {
	return contextualKB("groog.qmk", qmkKB, basicKB)
}

func panelSplit(panelKB, otherKB *KB) map[string]*KB {
	return contextualKB("activePanel", panelKB, otherKB)
}

func terminalSplit(terminalKB, otherKB *KB) map[string]*KB {
	return contextualKB(terminalFocus, terminalKB, otherKB)
}

func recordingSplit(recordingKB, otherKB *KB) map[string]*KB {
	return contextualKB("groog.recording", recordingKB, otherKB)
}

// TODO: change implementation so we don't need separate
// initialization of "ctrl+x c" and ctrl+x ctrl+c"
func ctrlX(c string) Key {
	return Key(fmt.Sprintf("ctrl+x ctrl+%s", c))
}
