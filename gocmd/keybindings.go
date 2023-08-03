package main

import (
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
)

type WC string

type WhenContext struct {
	value       string
	singleValue bool
}

func (wc *WhenContext) and(that *WhenContext) *WhenContext {
	return &WhenContext{
		fmt.Sprintf("%s && %s", wc.value, that.value),
		false,
	}
}

func (wc *WhenContext) or(that *WhenContext) *WhenContext {
	return &WhenContext{
		fmt.Sprintf("%s || %s", wc.value, that.value),
		false,
	}
}

func (wc *WhenContext) not() *WhenContext {
	if !wc.singleValue {
		panic("Can only negate a single when context")
	}
	return &WhenContext{
		fmt.Sprintf("!%s", wc.value),
		false,
	}
}

func wc(s string) *WhenContext {
	return &WhenContext{s, true}
}

func groogContext(mode string) string {
	// Logic copied from 'setGroogContext' function
	return fmt.Sprintf("groog.context.%sMode", mode)
}

var (
	// When contexts
	activePanel           = wc("activePanel")
	always                = wc("")
	editorFocus           = wc("editorFocus")
	editorTextFocus       = wc("editorTextFocus")
	findWidgetVisible     = wc("findWidgetVisible")
	findInputFocussed     = wc("findInputFocussed")
	inputFocus            = wc("inputFocus")
	groogFindMode         = wc(groogContext("find"))
	groogQMK              = wc(groogContext("qmk"))
	groogRecording        = wc(groogContext("record"))
	groogTerminalFindMode = wc(groogContext("terminal.find"))
	inQuickOpen           = wc("inQuickOpen")
	inSearchEditor        = wc("inSearchEditor")
	panelFocus            = wc("panelFocus")
	searchViewletFocus    = wc("searchViewletFocus")
	sideBarFocus          = wc("sideBarFocus")
	suggestWidgetVisible  = wc("suggestWidgetVisible")
	terminalFocus         = wc("terminalFocus")
	// terminal.visible is true even when the terminal is in the back,
	// hence why we need to use view.terminal.visible here.
	terminalVisible     = wc("view.terminal.visible")
	searchInputBoxFocus = wc("searchInputBoxFocus")

	// Ignore typing when in find widget
	characters = strings.Join([]string{
		// Keyboard rows
		"`1234567890-=",
		`qwertyuiop[]\`,
		`asdfghjkl;'`,
		`zxcvbnm,./`,
	}, "")
	shiftedCharacters = strings.Join([]string{
		// Keyboard rows
		`~!@#$%^&*()_+`,
		`QWERTYUIOP{}|`,
		`ASDFGHJKL:"`,
		`ZXCVBNM<>?`,
	}, "")

	// The context to use for keys that should have no binding in global find or
	// input boxes, etc.
	groogBehaviorContext = editorTextFocus.or(findInputFocussed)

	// The execute wrap for terminAllOrNothing
	terminAllOrNothingExecute = "termin-all-or-nothing.execute"
)

const (
	// Keys
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
	space     = "space"
)

func kbDefsToBindings() []*Keybinding {
	// First add overrides when not in text editor
	for ci, c := range characters {
		k := Key(c)
		for si, s := range []Key{k, shift(k)} {
			if _, ok := kbDefinitions[s]; ok {
				panic(fmt.Sprintf("kbDefinitions already contains key for %s", s))
			}
			text := s
			if si != 0 {
				text = Key(shiftedCharacters[ci])
			}

			kbDefinitions[s] = map[string]*KB{
				groogBehaviorContext.value: kbArgs("groog.type", map[string]interface{}{
					"text": text,
				}),
			}
		}
	}

	// Then create all json values
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
			for _, ka := range key.keyAliases() {
				kbs = append(kbs, &Keybinding{
					Key:     ka,
					When:    when,
					Command: kb.Command,
					Args:    kb.Args,
				})
			}
		}
	}
	return kbs
}

var (
	revealInNewEditor = onlyMC(
		"workbench.action.splitEditorRight",
		"editor.action.revealDefinition",
	)
)

var (
	// Map from key to "when context" to command to run in that context
	// TODO: logic to ensure unique keys (not guaranteed by compiler or runtime since using functions to generate keys)
	kbDefinitions = map[Key]map[string]*KB{
		// Find bindings
		ctrl("f"): {
			groogQMK.and(terminalVisible).value:                                 kb("groog.terminal.find"),
			groogQMK.and(terminalVisible.not()).and(groogRecording).value:       kb("groog.record.findNext"),
			groogQMK.and(terminalVisible.not()).and(groogRecording.not()).value: kb("groog.find"),
			groogQMK.not().and(inQuickOpen).value:                               kb("workbench.action.quickPickManyToggle"),
			groogQMK.not().and(inQuickOpen.not()).value:                         kb("groog.cursorRight"),
		},
		ctrl("s"): {
			groogQMK.not().and(terminalVisible).value:                                 kb("groog.terminal.find"),
			groogQMK.not().and(terminalVisible.not()).and(groogRecording).value:       kb("groog.record.findNext"),
			groogQMK.not().and(terminalVisible.not()).and(groogRecording.not()).value: kb("groog.find"),
			groogQMK.value: kb("groog.cursorRight"),
		},
		// Don't use 'terminalVisible' here because we don't want ctrl+r to activate terminal find mode.
		// Instead, we want ctrl+r in non-find mode to search for matching bash commands (as it normally would)
		ctrl("r"): contextualKB(groogTerminalFindMode, kb("groog.terminal.reverseFind"), kb("groog.reverseFind")),
		shift(enter): {
			groogFindMode.value:         kb("editor.action.previousMatchFindAction"),
			groogTerminalFindMode.value: kb("groog.terminal.reverseFind"),
		},
		enter: {
			groogTerminalFindMode.value: kb("groog.terminal.find"),
			groogFindMode.value:         kb("editor.action.nextMatchFindAction"),
			// This is needed so enter hits are recorded
			// Don't do for tab since that can add a variable
			// number of spaces. If seems necessary, we can add
			// groog.tab later on, but given tab's dynamic nature
			// depending on file type and context, that may become
			// tricky rather quickly.
			groogRecording.value: kbArgs("groog.type", map[string]interface{}{
				"text": "\n",
			}),
		},
		space: {
			groogBehaviorContext.value: kbArgs("groog.type", map[string]interface{}{
				"text": " ",
			}),
		},
		shift(space): {
			groogBehaviorContext.value: kbArgs("groog.type", map[string]interface{}{
				"text": " ",
			}),
		},
		alt("r"):        findToggler("Regex", nil, nil),
		alt("c"):        findToggler("CaseSensitive", nil, nil),
		alt("w"):        findToggler("WholeWord", nil, nil),
		alt(shift("c")): only("togglePreserveCase"),
		alt("f4"): findToggler("WholeWord", groogQMK, map[string]*KB{
			groogQMK.not().value: notification("Run alt+shift+f4 to close the window"),
		}),
		alt(shift("f4")): only("workbench.action.closeWindow"),

		// Emacs bindings
		ctrl("w"): only("groog.yank"),
		ctrl("j"): {
			// Jumps to other input box in find mode
			groogFindMode.value: kb("groog.find.toggleReplaceMode"),
			// Change panel in terminal
			groogFindMode.not().and(activePanel).value: kb("workbench.action.previousPanelView"),
			// Start mark mode in regular editor
			groogFindMode.not().and(activePanel.not()).value: kb("groog.toggleMarkMode"),
		},
		ctrl("y"):        only("groog.paste"),
		ctrl(shift("k")): only("editor.action.replaceAll"),
		ctrl("k"): {
			// Replace in find mode
			groogFindMode.value: kb("editor.action.replaceOne"),
			// Kill in editor
			groogFindMode.not().value: kb("groog.kill"),
		},
		ctrl("l"): panelSplit(
			kb("workbench.action.nextPanelView"),
			kb("groog.jump"),
		),
		pageup:           textOnly("groog.jump"),
		ctrl("v"):        only("groog.fall"),
		pagedown:         textOnly("groog.fall"),
		ctrl(shift("p")): only("groog.find.previous"),
		ctrl("p"): {
			groogTerminalFindMode.value: kb("groog.terminal.reverseFind"),
			always.value:                kb("-workbench.action.quickOpen"),
			editorTextFocus.and(suggestWidgetVisible.not()).value: kb("groog.cursorUp"),
			editorTextFocus.and(suggestWidgetVisible).value:       kb("selectPrevSuggestion"),
			inQuickOpen.value:   kb("workbench.action.quickOpenNavigatePreviousInFilePicker"),
			groogFindMode.value: kb("editor.action.previousMatchFindAction"),
			searchViewletFocus.value: mc(
				"search.action.focusPreviousSearchResult",
				"search.action.focusSearchList",
			),
		},
		up: {
			groogTerminalFindMode.value:                           kb("groog.terminal.reverseFind"),
			editorTextFocus.and(suggestWidgetVisible.not()).value: kb("groog.cursorUp"),
			editorTextFocus.and(suggestWidgetVisible).value:       kb("selectPrevSuggestion"),
			inQuickOpen.value:                                     kb("workbench.action.quickOpenNavigatePreviousInFilePicker"),
			groogFindMode.value:                                   kb("editor.action.previousMatchFindAction"),
		},
		ctrl("n"): {
			groogTerminalFindMode.value: kb("groog.terminal.find"),
			always.value:                kb("-workbench.action.files.newUntitledFile"),
			editorTextFocus.and(suggestWidgetVisible.not()).value: kb("groog.cursorDown"),
			editorTextFocus.and(suggestWidgetVisible).value:       kb("selectNextSuggestion"),
			inQuickOpen.value:         kb("workbench.action.quickOpenNavigateNextInFilePicker"),
			groogFindMode.value:       kb("editor.action.nextMatchFindAction"),
			searchInputBoxFocus.value: kb("search.action.focusSearchList"),
			searchViewletFocus.value: mc(
				"search.action.focusNextSearchResult",
				"search.action.focusSearchList",
			),
		},
		down: {
			groogTerminalFindMode.value:                           kb("groog.terminal.find"),
			editorTextFocus.and(suggestWidgetVisible.not()).value: kb("groog.cursorDown"),
			editorTextFocus.and(suggestWidgetVisible).value:       kb("selectNextSuggestion"),
			inQuickOpen.value:                                     kb("workbench.action.quickOpenNavigateNextInFilePicker"),
			groogFindMode.value:                                   kb("editor.action.nextMatchFindAction"),
			searchInputBoxFocus.value:                             kb("search.action.focusSearchList"),
		},
		left: {
			inQuickOpen.value: kb("workbench.action.quickPickManyToggle"),
			editorTextFocus.and(inQuickOpen.not()).value: kb("groog.cursorLeft"),
		},
		ctrl("b"): {
			inQuickOpen.value:       kb("workbench.action.quickPickManyToggle"),
			inQuickOpen.not().value: kb("groog.cursorLeft"),
		},
		right: {
			inQuickOpen.value: kb("workbench.action.quickPickManyToggle"),
			editorTextFocus.and(inQuickOpen.not()).value: kb("groog.cursorRight"),
		},
		home:              textOnly("groog.cursorHome"),
		ctrl("a"):         keyboardSplit(kb("groog.cursorHome"), kb("editor.action.selectAll")),
		ctrl(shift("a")):  only("editor.action.selectAll"),
		ctrl(shift(home)): only("editor.action.selectAll"),
		shift(home):       only("editor.action.selectAll"),
		end:               textOnly("groog.cursorEnd"),
		ctrl("e"):         only("groog.cursorEnd"),
		alt("f"):          only("groog.cursorWordRight"),
		ctrl("g"): {
			sideBarFocus.not().and(inQuickOpen.not().and(suggestWidgetVisible.not())).value: kb("groog.ctrlG"),
			sideBarFocus.and(inQuickOpen.not().and(suggestWidgetVisible.not())).value:       kb("workbench.action.focusActiveEditorGroup"),
			inQuickOpen.and(suggestWidgetVisible.not()).value:                               kb("workbench.action.closeQuickOpen"),
			suggestWidgetVisible.value: kb("hideSuggestWidget"),
		},
		ctrl("/"):   panelSplit(nil, kb("groog.undo")),
		ctrl(right): textOnly("groog.cursorWordRight"),
		alt("b"):    only("groog.cursorWordLeft"),
		ctrl(left):  textOnly("groog.cursorWordLeft"),
		ctrlX("p"):  only("groog.cursorTop"),
		ctrlX("s"):  only("workbench.action.files.save"),
		ctrl("h"): {
			searchViewletFocus.not().value: kb("groog.deleteLeft"),
			searchViewletFocus.value:       kb("search.action.remove"),
		},
		backspace: {
			groogBehaviorContext.value:                              kb("groog.deleteLeft"),
			searchInputBoxFocus.not().and(searchViewletFocus).value: kb("search.action.remove"),
		},
		ctrl("d"): {
			searchViewletFocus.not().value: kb("groog.deleteRight"),
			searchViewletFocus.value:       kb("search.action.remove"),
		},
		delete: {
			groogBehaviorContext.value:                              kb("groog.deleteRight"),
			searchInputBoxFocus.not().and(searchViewletFocus).value: kb("search.action.remove"),
		},
		alt("h"):       only("groog.deleteWordLeft"),
		alt(backspace): textOnly("groog.deleteWordLeft"),
		ctrl(backspace): {
			groogQMK.and(panelFocus).value: sendSequence("\u0008"),
			editorTextFocus.value:          kb("groog.deleteWordLeft"),
			// groogQMK.not().or(panelFocus.not()).value: kb("groog.deleteWordLeft"),
		},
		alt("d"):     only("groog.deleteWordRight"),
		alt(delete):  textOnly("groog.deleteWordRight"),
		ctrl(delete): textOnly("groog.deleteWordRight"),
		alt("x"):     only("workbench.action.showCommands"),
		ctrlX("l"):   only("workbench.action.gotoLine"),
		ctrl(";"):    only("editor.action.commentLine"),

		// File navigation
		// closePanel is taken care of by termin-all-or-nothing
		ctrlX("f"): only("workbench.action.quickOpen"),
		ctrlX("v"): onlyMC(
			"workbench.action.splitEditorDown",
			"groog.focusPreviousEditor",
		),
		ctrl(shift("v")): onlyMC(
			"workbench.action.splitEditorDown",
			"workbench.action.quickOpen",
		),
		ctrlX("h"): onlyMC(
			"workbench.action.splitEditorRight",
			"groog.focusPreviousEditor",
		),
		ctrl(shift("h")): onlyMC(
			"workbench.action.splitEditorRight",
			"workbench.action.quickOpen",
		),
		ctrl(pagedown): only("groog.focusNextEditor"),
		ctrl(pageup):   only("groog.focusPreviousEditor"),
		ctrl(shift("n")): {
			groogFindMode.value:       kb("groog.find.next"),
			groogFindMode.not().value: kb("workbench.action.files.newUntitledFile"),
		},
		// In our QMK keyboard, pressing "shift+n" in the LR_CTRL layer
		// actually sends "shift+down" (no ctrl modifier).
		// So when trying to press "ctrl+shift+n", do the same thing (new file).
		shift(down):      onlyKBWhen(kb("workbench.action.files.newUntitledFile"), groogQMK),
		ctrlX("d"):       only("editor.action.revealDefinition"),
		ctrl(shift("d")): revealInNewEditor,
		shift(delete):    revealInNewEditor,
		ctrl(pagedown): panelSplit(
			kb("workbench.action.terminal.focusNext"),
			kb("groog.focusNextEditor"),
		),
		ctrl(pageup): panelSplit(
			kb("workbench.action.terminal.focusPrevious"),
			kb("groog.focusPreviousEditor"),
		),
		ctrl("u"): panelSplit(
			kb("workbench.action.terminal.focusPrevious"),
			kb("groog.focusPreviousEditor"),
		),
		ctrl("o"): panelSplit(
			kb("workbench.action.terminal.focusNext"),
			kb("groog.focusNextEditor"),
		),
		ctrl(shift(tab)): panelSplit(
			kb("workbench.action.terminal.focusPrevious"),
			kb("groog.focusPreviousEditor"),
		),
		ctrl(tab): panelSplit(
			kb("workbench.action.terminal.focusNext"),
			kb("groog.focusNextEditor"),
		),
		ctrlX("b"): only("editor.action.jumpToBracket"),

		// Recording bindings
		ctrlX("x"): only("groog.record.startRecording"),
		alt("e"): recordingSplit(
			kb("groog.record.endRecording"),
			kb("groog.record.playRecording"),
		),
		alt(shift("e")): recordingSplit(
			kb("groog.record.saveRecordingAs"),
			kb("groog.record.playNamedRecording"),
		),
		alt(shift("d")): only("groog.record.deleteRecording"),
		ctrl(shift("s")): {
			groogQMK.not().and(groogRecording).value:       kb("groog.record.find"),
			groogQMK.not().and(groogRecording.not()).value: kb("workbench.action.findInFiles"),
		},
		ctrl(shift("f")): {
			groogQMK.and(groogRecording).value:       kb("groog.record.find"),
			groogQMK.and(groogRecording.not()).value: kb("workbench.action.findInFiles"),
		},

		// Terminal and panel related bindings
		ctrlX("q"): only("workbench.action.toggleSidebarVisibility"),
		ctrlX("z"): only("workbench.action.togglePanel"),
		// Really want to make sure we want to kill a terminal
		// so we notify on ctrl+q and actually delete on ctrl+shift+q.
		ctrl("q"): panelSplit(
			notification("Run ctrl+shift+q to kill the terminal"),
			kb("workbench.action.closeEditorsAndGroup"),
		),
		ctrl(shift("q")): panelSplit(kb("workbench.action.terminal.kill"), nil),
		ctrlX("n"): panelSplit(
			kb("workbench.action.terminal.rename"),
			kb("groog.cursorBottom"),
		),
		ctrl("t"): panelSplit(
			mc("groog.ctrlG", "termin-all-or-nothing.closePanel"),
			mc("groog.ctrlG", "termin-all-or-nothing.openPanel"),
		),
		// alt-t on QMK keyboard is actually ctrl+shift+t (for new tab)
		ctrl(shift("t")): only("workbench.action.terminal.newInActiveWorkspace"),
		alt("t"):         only("workbench.action.terminal.newInActiveWorkspace"),
		alt(shift("t")):  only("workbench.action.terminal.newWithProfile"),
		// Ctrl+x ctrl+c isn't sent to terminal directly, so we need to
		// explicitly send the sequence.
		// See below link for unicode characters:
		// https://en.wikipedia.org/wiki/List_of_Unicode_characters
		// ctrlX("c"): panelSplit(sendSequence("\u0018\u0003"), nil),
		ctrlX("c"): panelSplit(
			mcWithArgs(
				notification("Terminal output copied!"),
				kb("workbench.action.terminal.copyLastCommandOutput"),
			),
			nil),

		// To determine this, I did the following
		// - ran `sed -n l` (as recommended in (1))
		// - pressed "ctrl+/"
		// - pressed enter to see following output: "\037$"
		// - Converted 37 octal to hexidecimal (looked up in (2)) to get 001f
		// (1): https://unix.stackexchange.com/questions/76566/where-do-i-find-a-list-of-terminal-key-codes-to-remap-shortcuts-in-bash
		// (2): https://en.wikipedia.org/wiki/List_of_Unicode_characters
		ctrl("z"): panelSplit(sendSequence("\u001F"), nil),

		// Formatting
		ctrlX(tab):       only("groog.format"),
		ctrl("i"):        only("editor.action.indentLines"),
		ctrl(shift("i")): only("editor.action.outdentLines"),
		ctrlX("i"):       only("editor.action.organizeImports"),
		alt("i"):         only("groog.indentToPreviousLine"),
		alt(shift("i")): {
			always.value:          kb("groog.indentToNextLine"),
			editorTextFocus.value: kb("-editor.action.insertCursorAtEndOfEachLineSelected"),
		},

		// Pasting
		ctrlX("y"): only("editor.action.clipboardPasteAction"),
		// ctrl+x ctrl+y on qmk keyboard
		ctrl("x shift+insert"): only("editor.action.clipboardPasteAction"),
		alt("y"):               only("editor.action.clipboardPasteAction"),

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

		// Markdown
		ctrlX("m"): {
			"editorLangId == 'markdown'": kb("markdown.showPreviewToSide"),
		},

		// Git
		alt("z"): only("git.revertSelectedRanges"),
		alt("p"): only("workbench.action.editor.previousChange"),
		alt("n"): only("workbench.action.editor.nextChange"),

		// Go
		ctrlX("t"): onlyArgs(terminAllOrNothingExecute, terminAllOrNothingWrap("go.test.package", nil)),

		// Miscellaneous
		ctrlX("r"): only("workbench.action.reloadWindow"),
		// Sometimes hit alt+g on qmk keyboard. This binding
		// ensures we don't change focus to the menu bar (File, Edit, ...).
		alt("g"):   only("noop"),
		ctrlX("o"): only("workbench.action.openRecent"),
		// ctrl+shift+l in qmk mode
		shift(pageup): {
			editorFocus.value: kb("editor.action.selectHighlights"),
		},
		ctrlX("k"): only("groog.toggleQMK"),
		ctrlX("e"): onlyMC(
			"workbench.view.extensions",
			"workbench.extensions.action.checkForUpdates",
		),
		// Prevent focus mode from ever being activated.
		ctrl("m"): only("-editor.action.toggleTabFocusMode"),
	}
)

type KB struct {
	Command string
	Args    map[string]interface{}
}

func terminAllOrNothingWrap(command string, args map[string]interface{}) map[string]interface{} {
	m := map[string]interface{}{
		"command": command,
	}
	if args != nil {
		m["args"] = args
	}
	return m
}

func only(command string) map[string]*KB {
	return onlyWhen(command, always)
}

func onlyArgs(command string, args map[string]interface{}) map[string]*KB {
	return onlyWhenArgs(command, always, args)
}

func textOnly(command string) map[string]*KB {
	return onlyWhen(command, groogBehaviorContext)
}

func onlyWhen(command string, context *WhenContext) map[string]*KB {
	return onlyWhenArgs(command, context, nil)
}

func onlyWhenArgs(command string, context *WhenContext, args map[string]interface{}) map[string]*KB {
	return onlyKBWhen(kbArgs(command, args), context)
}

func onlyKB(kb *KB) map[string]*KB {
	return onlyKBWhen(kb, always)
}

func onlyKBWhen(kb *KB, context *WhenContext) map[string]*KB {
	return map[string]*KB{
		context.value: kb,
	}
}

func kb(cmd string) *KB {
	return kbArgs(cmd, nil)
}

// TODO: combine this with mc
func onlyMC(cmds ...string) map[string]*KB {
	return onlyKB(mc(cmds...))
}

func notification(message string) *KB {
	return kbArgs("groog.message.info", map[string]interface{}{
		"message": message,
	})
}

func mcWithArgs(cmds ...*KB) *KB {
	var sequence []map[string]interface{}
	for _, c := range cmds {
		sequence = append(sequence, map[string]interface{}{
			"command": c.Command,
			"args":    c.Args,
		})
	}

	return kbArgs("groog.multiCommand.execute", map[string]interface{}{
		"sequence": sequence,
	})
}

func mc(cmds ...string) *KB {
	var sequence []map[string]interface{}
	for _, c := range cmds {
		sequence = append(sequence, map[string]interface{}{
			"command": c,
		})
	}

	return kbArgs("groog.multiCommand.execute", map[string]interface{}{
		"sequence": sequence,
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

func (k Key) keyAliases() []string {
	kas := []string{
		k.ToString(),
	}

	// Ctrl+x duplication
	prefix := "ctrl+x "
	if strings.HasPrefix(k.ToString(), prefix) {
		kas = append(kas, fmt.Sprintf("%sctrl+%s", prefix, k.ToString()[len(prefix):]))
	}

	return kas
}

func findToggler(suffix string, context *WhenContext, m map[string]*KB) map[string]*KB {
	groogCmd := fmt.Sprintf("groog.find.toggle%s", suffix)
	ef := editorFocus
	se := inSearchEditor
	sv := searchViewletFocus
	neg := editorFocus.not().and(inSearchEditor.not()).and(searchViewletFocus.not())
	if context != nil {
		ef = context.and(ef)
		se = context.and(se)
		sv = context.and(sv)
		neg = context.and(neg)
	}
	r := map[string]*KB{
		ef.value:  mc(groogCmd, fmt.Sprintf("toggleFind%s", suffix)),
		se.value:  mc(groogCmd, fmt.Sprintf("toggleSearchEditor%s", suffix)),
		sv.value:  mc(groogCmd, fmt.Sprintf("toggleSearch%s", suffix)),
		neg.value: mc(groogCmd, fmt.Sprintf("toggleSearch%s", suffix)),
	}
	for k, v := range m {
		r[k] = v
	}
	return r
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
func contextualKB(context *WhenContext, trueKB, falseKB *KB) map[string]*KB {
	contextKey := context.value
	if !simpleContextRegex.MatchString(contextKey) {
		panic(fmt.Sprintf("context key (%q) does not match required regexp (%s)", contextKey, simpleContextRegex))
	}
	return map[string]*KB{
		contextKey:                     trueKB,
		fmt.Sprintf("!%s", contextKey): falseKB,
	}
}

func keyboardSplit(basicKB, qmkKB *KB) map[string]*KB {
	return contextualKB(groogQMK, qmkKB, basicKB)
}

// panelSplit runs panelKB if the panel is avtice (i.e. visible) (so it may or
// may not be focused), and otherKB otherwise.
func panelSplit(panelKB, otherKB *KB) map[string]*KB {
	return contextualKB(activePanel, panelKB, otherKB)
}

// terminalSplit runs terminalKB if focus is on the terminal and otherKB otherwise.
// panelSplit should be preferred since it will still run panelKB even if focus
// is on the side bar or menus.
/*func terminalSplit(terminalKB, otherKB *KB) map[string]*KB {
	return contextualKB(terminalFocus, terminalKB, otherKB)
}*/

func recordingSplit(recordingKB, otherKB *KB) map[string]*KB {
	return contextualKB(groogRecording, recordingKB, otherKB)
}

func ctrlX(c string) Key {
	return Key(fmt.Sprintf("ctrl+x %s", c))
}
