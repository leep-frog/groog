package main

import (
	"fmt"
	"regexp"
	"strings"

	"golang.org/x/exp/maps"
	"golang.org/x/exp/slices"
)

type WhenContext interface {
	value() string
}

type SimpleContext struct {
	context  string
	negative bool
}

func (sc *SimpleContext) value() string {
	if sc.negative {
		return fmt.Sprintf("!%s", sc.context)
	}
	return sc.context
}

func simpleContext(context string) *SimpleContext {
	return &SimpleContext{
		context: context,
	}
}

func wc(context string) *SimpleContext {
	return simpleContext(context)
}

func (sc *SimpleContext) not() *SimpleContext {
	return &SimpleContext{
		context:  sc.context,
		negative: !sc.negative,
	}
}

type ComparisonContext struct {
	left  string
	right string
	equal bool
}

func (cc *ComparisonContext) value() string {
	if cc.equal {
		return fmt.Sprintf("%s == %s", cc.left, cc.right)
	}
	return fmt.Sprintf("%s != %s", cc.left, cc.right)
}

func (cc *ComparisonContext) not() *ComparisonContext {
	return &ComparisonContext{
		left:  cc.left,
		right: cc.right,
		equal: !cc.equal,
	}
}

type OperationContext struct {
	parts     []WhenContext
	operation string
}

func (oc *OperationContext) value() string {
	var values []string
	for _, part := range oc.parts {
		values = append(values, part.value())
	}
	return fmt.Sprintf("%s", strings.Join(values, fmt.Sprintf(" %s ", oc.operation)))
}

func and(contexts ...WhenContext) WhenContext {
	return &OperationContext{contexts, "&&"}
}

func or(contexts ...WhenContext) WhenContext {
	return &OperationContext{contexts, "||"}
}

// See the following link for language codes: https://code.visualstudio.com/docs/languages/identifiers
func whenFileType(languageId string) WhenContext {
	return wcCmp("resourceLangId", languageId, true)
}

func whenNotFileType(languageId string) WhenContext {
	return wcCmp("resourceLangId", languageId, false)
}

func wcCmp(key, value string, eql bool) WhenContext {
	return &ComparisonContext{key, value, eql}
}

func groogContext(mode string) string {
	// Logic copied from 'setGroogContext' function
	return fmt.Sprintf("groog.context.%sMode", mode)
}

func async(b bool) *bool {
	return &b
}

func delay(n int) *int {
	return &n
}

var (
	// When contexts
	activePanel     = wc("activePanel")
	always          = wc("")
	editorFocus     = wc("editorFocus")
	editorTextFocus = wc("editorTextFocus")
	// TODO: Change WhenContext for better not usage
	debugConsoleFocus    = wcCmp("focusedView", "'workbench.panel.repl.view'", true)
	notDebugConsoleFocus = wcCmp("focusedView", "'workbench.panel.repl.view'", false)

	findWidgetVisible       = wc("findWidgetVisible")
	findInputFocussed       = wc("findInputFocussed")
	inputFocus              = wc("inputFocus")
	auxiliaryBarVisible     = wc("auxiliaryBarVisible")
	notebookEditorFocused   = wc("notebookEditorFocused")
	notebookMarkdownCell    = wc("notebookCellType == 'markup'")
	notebookCodeCell        = wc("notebookCellType == 'code'")
	groogFindMode           = wc(groogContext("find"))
	groogSimpleFindMode     = wc(groogContext("find.simple"))
	groogQMK                = wc(groogContext("qmk"))
	groogRecording          = wc(groogContext("record"))
	groogTerminalFindMode   = wc(groogContext("terminal.find"))
	inQuickOpen             = wc("inQuickOpen")
	inSearchEditor          = wc("inSearchEditor")
	inSnippetMode           = wc("inSnippetMode")
	panelFocus              = wc("panelFocus")
	listFocus               = wc("listFocus")
	listSupportsMultiselect = wc("listSupportsMultiselect")
	searchViewletFocus      = wc("searchViewletFocus")
	sideBarFocus            = wc("sideBarFocus")
	suggestWidgetVisible    = wc("suggestWidgetVisible")
	terminalFocus           = wc("terminalFocus")
	inlineChatVisible       = wc("inlineChatVisible")
	// terminal.visible is true even when the terminal is in the back,
	// hence why we need to use view.terminal.visible here.
	terminalVisible     = wc("view.terminal.visible")
	searchInputBoxFocus = wc("searchInputBoxFocus")

	// When comparison contexts
	goFile         = whenFileType("go")
	notGoFile      = whenNotFileType("go")
	javaFile       = whenFileType("java")
	typescriptFile = whenFileType("typescript")

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
	groogBehaviorContext = and(or(editorTextFocus, notDebugConsoleFocus, findInputFocussed, inQuickOpen), groogFindMode)

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
	escape    = "escape"
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
				groogBehaviorContext.value(): kbArgs("groog.type", map[string]interface{}{
					"text": text,
				}),
			}
		}
	}

	// Then create all json values
	keys := append(maps.Keys(kbDefinitions), maps.Keys(removeKeybindings)...)
	slices.Sort(keys)

	var kbs []*Keybinding
	visited := map[Key]bool{}
	for _, key := range keys {
		// Sometimes have duplicates due to append statement above
		if visited[key] {
			continue
		}
		visited[key] = true

		// Add the new keybindings
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
					// We don't set Async or Delay because those are only used in multi-command args
				})
			}
		}

		// Remove keybindings we don't want
		for _, cmd := range removeKeybindings[key] {
			for _, ka := range key.keyAliases() {
				kbs = append(kbs, &Keybinding{
					Key:     ka,
					Command: fmt.Sprintf("-%s", cmd),
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
	// Map from keybindings to command binding to remove
	removeKeybindings = map[Key][]string{
		alt(shift("r")): {
			"revealFileInOS",
			"remote-wsl.revealInExplorer",
		},
		// Added by git extension
		ctrlLeader("l", "g"): {"extension.openInGitHub"},
		ctrlLeader("l", "p"): {"extension.openPrGitProvider"},
		ctrlLeader("l", "c"): {"extension.copyGitHubLinkToClipboard"},
	}
	// Map from key to "when context" to command to run in that context
	// TODO: logic to ensure unique keys (not guaranteed by compiler or runtime since using functions to generate keys)
	kbDefinitions = map[Key]map[string]*KB{
		// Find bindings
		ctrl("f"): {
			and(groogQMK, terminalVisible).value(): kb("groog.terminal.find"),
			// This is mostly relevant for Find Simple Mode (so `ctrl+s; ctrl+s` results in redoing previous find)
			and(groogQMK, terminalVisible.not(), inQuickOpen, groogSimpleFindMode).value(): kb("workbench.action.acceptSelectedQuickOpenItem"),
			and(groogQMK, terminalVisible.not()).value():                                   kb("groog.find"),
			and(groogQMK.not(), editorTextFocus, inQuickOpen.not()).value():                kb("groog.cursorRight"),
			always.value(): kb("-workbench.action.terminal.focusFind"),
		},
		ctrl("s"): {
			// "workbench.action.acceptSelectedQuickOpenItem",
			groogQMK.value(): kb("groog.cursorRight"),
			and(groogQMK.not(), terminalVisible).value(): kb("groog.terminal.find"),
			// This is mostly relevant for Find Simple Mode (so `ctrl+s; ctrl+s` results in redoing previous find)
			and(groogQMK.not(), terminalVisible.not(), inQuickOpen, groogSimpleFindMode).value(): kb("workbench.action.acceptSelectedQuickOpenItem"),
			and(groogQMK.not(), terminalVisible.not()).value():                                   kb("groog.find"),
		},
		// Don't use 'terminalVisible' here because we don't want ctrl+r to activate terminal find mode.
		// Instead, we want ctrl+r in non-find mode to search for matching bash commands (as it normally would)
		ctrl("r"): contextualKB(groogTerminalFindMode, kb("groog.terminal.reverseFind"), kb("groog.reverseFind")),
		shift(enter): {
			groogFindMode.value():         kb("editor.action.previousMatchFindAction"),
			groogTerminalFindMode.value(): kb("groog.terminal.reverseFind"),
		},
		ctrl(enter): only("-github.copilot.generate"),
		enter: {
			suggestWidgetVisible.value():  kb("acceptSelectedSuggestion"),
			groogTerminalFindMode.value(): kb("groog.terminal.find"),
			groogFindMode.value():         kb("editor.action.nextMatchFindAction"),
			// This is needed so enter hits are recorded
			// Don't do for tab since that can add a variable
			// number of spaces. If seems necessary, we can add
			// groog.tab later on, but given tab's dynamic nature
			// depending on file type and context, that may become
			// tricky rather quickly.
			groogRecording.value(): kbArgs("groog.type", map[string]interface{}{
				"text": "\n",
			}),
		},
		space: {
			groogBehaviorContext.value(): kbArgs("groog.type", map[string]interface{}{
				"text": " ",
			}),
		},
		shift(space): {
			groogBehaviorContext.value(): kbArgs("groog.type", map[string]interface{}{
				"text": " ",
			}),
		},
		alt("r"): findToggler("Regex", nil, map[string]*KB{
			and(notebookEditorFocused, notebookCodeCell).value():     kb("notebook.cell.execute"),
			and(notebookEditorFocused, notebookMarkdownCell).value(): kb("notebook.cell.quitEdit"),
		}),
		alt("c"):        findToggler("CaseSensitive", nil, nil),
		alt("w"):        findToggler("WholeWord", nil, nil),
		alt(shift("c")): only("togglePreserveCase"),
		alt("f4"): findToggler("WholeWord", groogQMK, map[string]*KB{
			groogQMK.not().value(): errorNotification("Run alt+shift+f4 to close the window"),
		}),
		alt(shift("f4")): only("workbench.action.closeWindow"),

		// Emacs bindings
		ctrl("w"):  only("groog.yank"),
		ctrlX("w"): only("groog.tug"),
		ctrl("j"): {
			// Jumps to other input box in find mode
			groogFindMode.value(): kb("groog.find.toggleReplaceMode"),
			// Change panel in terminal
			and(groogFindMode.not(), activePanel).value(): kb("workbench.action.previousPanelView"),
			// Start mark mode in regular editor
			and(groogFindMode.not(), activePanel.not()).value(): kb("groog.toggleMarkMode"),
		},
		ctrl("y"):        only("groog.emacsPaste"),
		ctrl(shift("k")): onlyWhen("groog.find.replaceAll", groogFindMode),
		ctrlX("k"):       only("groog.maim"),
		ctrl("k"): {
			// Replace in find mode
			groogFindMode.value(): kb("groog.find.replaceOne"),
			// Kill in editor
			groogFindMode.not().value(): kb("groog.kill"),
		},
		ctrl("l"):        ctrlLBindings(),
		ctrl(shift("l")): ctrlShiftLBindings(),
		pageup:           ctrlLBindings(),
		shift(pageup):    ctrlShiftLBindings(),
		ctrl("v"):        ctrlVBindings(),
		ctrl(shift("v")): ctrlShiftVBindings(),
		pagedown:         ctrlVBindings(),
		shift(pagedown):  ctrlShiftVBindings(),
		ctrl(shift("p")): only("groog.find.previous"),
		ctrlZ("l"): {
			inlineChatVisible.value():       kb("inlineChat.close"),
			inlineChatVisible.not().value(): kb("inlineChat.start"),
		},
		ctrlZ("pageup"): {
			inlineChatVisible.value():       kb("inlineChat.close"),
			inlineChatVisible.not().value(): kb("inlineChat.start"),
		},
		ctrlZ(";"): {
			auxiliaryBarVisible.value():       kb("workbench.action.toggleAuxiliaryBar"),
			auxiliaryBarVisible.not().value(): kb("workbench.panel.chat.view.copilot.focus"),
		},
		alt("q"): only("editor.action.inlineSuggest.trigger"),
		shift(up): {
			and(groogQMK, groogFindMode).value(): kb("groog.find.previous"),
		},
		ctrl("p"): upBindings(),
		up:        upBindings(),
		ctrl("n"): downBindings(),
		down:      downBindings(),
		left:      leftBindings(),
		ctrl("b"): leftBindings(),
		ctrl("m"): onlyWhen("workbench.action.quickPickManyToggle", and(inQuickOpen, listSupportsMultiselect)),
		right: {
			and(editorTextFocus, inQuickOpen.not()).value(): kb("groog.cursorRight"),
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
			and(sideBarFocus, inQuickOpen.not(), suggestWidgetVisible.not()).value():  kb("workbench.action.focusActiveEditorGroup"),
			and(inQuickOpen, suggestWidgetVisible.not(), groogFindMode.not()).value(): kb("workbench.action.closeQuickOpen"),
			suggestWidgetVisible.value(): kb("hideSuggestWidget"),
			always.value():               kb("groog.ctrlG"),
		},
		ctrl("/"): {
			activePanel.value():                                  nil,
			and(activePanel.not(), groogRecording).value():       kb("groog.record.undo"),
			and(activePanel.not(), groogRecording.not()).value(): kb("groog.undo"),
		},
		ctrl(shift("/")): {
			activePanel.value():                                  nil,
			and(activePanel.not(), groogRecording).value():       nil,
			and(activePanel.not(), groogRecording.not()).value(): kb("groog.redo"),
		},
		ctrl(right): textOnly("groog.cursorWordRight"),
		alt("b"):    only("groog.cursorWordLeft"),
		ctrl(left):  textOnly("groog.cursorWordLeft"),
		ctrlX("p"):  only("groog.cursorTop"),
		ctrlX("s"):  only("workbench.action.files.save"),
		ctrl("h"): {
			searchViewletFocus.not().value(): kb("groog.deleteLeft"),
			searchViewletFocus.value():       kb("search.action.remove"),
		},
		backspace: {
			groogBehaviorContext.value():               kb("groog.deleteLeft"),
			and(searchViewletFocus, listFocus).value(): kb("search.action.remove"),
		},
		ctrl("d"): {
			searchViewletFocus.not().value(): kb("groog.deleteRight"),
			searchViewletFocus.value():       kb("search.action.remove"),
		},
		delete: {
			groogBehaviorContext.value():               kb("groog.deleteRight"),
			and(searchViewletFocus, listFocus).value(): kb("search.action.remove"),
			notebookEditorFocused.value():              kb("-notebook.cell.delete"),
		},
		alt("h"):       only("groog.deleteWordLeft"),
		alt(backspace): textOnly("groog.deleteWordLeft"),
		ctrl(backspace): {
			// Requires following command in shell/powershell profiles:
			// Bash:
			// bind '"\C-x\C-h":backward-kill-word'
			//
			// PowerShell:
			// Set-PSReadLineKeyHandler -Chord Ctrl+x,Ctrl+h -ScriptBlock {
			// 	[Microsoft.PowerShell.PSConsoleReadLine]::BackwardDeleteWord()
			// }
			and(groogQMK, terminalFocus).value(): sendSequence("\u0018\u0008"),
			groogBehaviorContext.value():         kb("groog.deleteWordLeft"),
			// groogQMK.not().or(panelFocus.not()).value(): kb("groog.deleteWordLeft"),
		},
		alt("d"):     only("groog.deleteWordRight"),
		alt(delete):  textOnly("groog.deleteWordRight"),
		ctrl(delete): textOnly("groog.deleteWordRight"),
		alt("x"):     only("workbench.action.showCommands"),
		ctrlZ("x"):   only("workbench.action.showCommands"),
		ctrlX("l"):   only("workbench.action.gotoLine"),
		// nextPanelView was removed from ctrl+l because we want that
		// to work as regular jump behavior in terminal editors (e.g. `git diff` interactions)
		ctrl(";"): panelSplit(kb("workbench.action.nextPanelView"), kb("editor.action.commentLine")),

		// File navigation
		// closePanel is taken care of by termin-all-or-nothing
		ctrlX("f"): only("workbench.action.quickOpen"),
		ctrlX("v"): onlyMC(
			"workbench.action.splitEditorDown",
		),
		ctrlZ("v"):      only("faves.toggle"),
		ctrlZ(pagedown): onlyWhen("faves.toggle", groogQMK),
		ctrlZ("s"):      only("workbench.action.files.saveWithoutFormatting"),
		ctrlZ("f"):      keyboardSplit(kb("faves.aliasSearch"), kb("workbench.action.files.saveWithoutFormatting")),
		ctrlZ(right):    onlyWhen("faves.aliasSearch", groogQMK),
		ctrlX("h"): onlyMC(
			"workbench.action.splitEditorRight",
		),
		ctrl(pagedown): only("groog.focusNextEditor"),
		ctrl(pageup):   only("groog.focusPreviousEditor"),
		// When there is a suggestible item highlighted, then accept it.
		tab: {
			groogFindMode.value(): kb("workbench.action.acceptSelectedQuickOpenItem"),
			// Have this be tab (not enter) because sometimes we want to press the actual
			// enter key in the middle of a snippet (and this will jump to the end of the
			// snippet input if at the last snippet input section).
			and(suggestWidgetVisible.not(), inSnippetMode).value(): kb("jumpToNextSnippetPlaceholder"),
		},
		ctrl(shift("n")): {
			groogFindMode.value():       kb("groog.find.next"),
			groogFindMode.not().value(): kb("workbench.action.files.newUntitledFile"),
		},
		// In our QMK keyboard, pressing "shift+n" in the LR_CTRL layer
		// actually sends "shift+down" (no ctrl modifier).
		// So when trying to press "ctrl+shift+n", do the same thing (new file).
		shift(down): {
			and(groogQMK, groogFindMode).value():       kb("groog.find.next"),
			and(groogQMK, groogFindMode.not()).value(): kb("workbench.action.files.newUntitledFile"),
		},
		ctrlX("d"):       only("editor.action.revealDefinition"),
		ctrlZ("d"):       revealInNewEditor,
		ctrlZ(delete):    revealInNewEditor,
		ctrlZ("n"):       only("cSpell.goToNextSpellingIssue"),
		ctrlZ(down):      only("cSpell.goToNextSpellingIssue"), // ~= qmk ctrl+z ctrl+n (since ctrl+n is down arrow)
		ctrl(shift("d")): revealInNewEditor,
		shift(delete):    revealInNewEditor,
		ctrl(pageup):     prevTab(),
		ctrl(pagedown):   nextTab(),
		ctrl("u"):        prevTab(),
		ctrl("o"):        nextTab(),
		ctrl(shift(tab)): prevTab(),
		ctrl(tab):        nextTab(),
		ctrlX("b"): onlyMC(
			// This re-opens the previously opened file
			"workbench.action.openPreviousEditorFromHistory",
			"workbench.action.acceptSelectedQuickOpenItem",
		),
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
		alt(shift("r")): {
			always.value():                kb("groog.record.playRecordingRepeatedly"),
			notebookEditorFocused.value(): kb("jupyter.restartkernelandrunuptoselectedcell"),
		},
		ctrl(shift("r")): {
			// Needed the delay temporarily, but no more?
			// notebookEditorFocused.value(): mcWithArgs(kb("jupyter.restartkernel"), &KB{Command: "notebook.cell.execute", Delay: delay(0)}),
			notebookEditorFocused.value(): mc("jupyter.restartkernel", "notebook.cell.execute"),
			// always.value():                kb("workbench.action.restartExtensionHost"),
		},
		alt(shift("d")): {
			always.value():                kb("groog.record.deleteRecording"),
			notebookEditorFocused.value(): kb("notebook.cell.delete"),
		},
		// (This is [alt layer]+shift+del on QMK)
		ctrl(shift(delete)): {
			always.value():                kb("groog.record.deleteRecording"),
			notebookEditorFocused.value(): kb("notebook.cell.delete"),
		},
		ctrl(shift("s")): onlyWhen("workbench.action.findInFiles", groogQMK.not()),
		ctrl(shift("f")): onlyWhen("workbench.action.findInFiles", groogQMK),
		shift(backspace): { // This is basically ctrl+shift+h
			groogQMK.value(): kb("workbench.action.replaceInFiles"),
		},

		// Terminal and panel related bindings
		ctrlX("q"): only("workbench.action.toggleSidebarVisibility"),
		ctrlX("z"): only("workbench.action.togglePanel"),
		// Really want to make sure we want to kill a terminal
		// so we notify on ctrl+q and actually delete on ctrl+shift+q.
		ctrl("q"): panelSplit(
			errorNotification("Run ctrl+shift+q to kill the terminal"),
			kb("workbench.action.closeEditorsAndGroup"),
		),
		ctrl(shift("q")): panelSplit(kb("workbench.action.terminal.kill"), nil),
		ctrlX("n"): panelSplit(
			kb("workbench.action.terminal.rename"),
			kb("groog.cursorBottom"),
		),
		ctrl("t"): merge(
			only("-workbench.action.showAllSymbols"),
			panelSplit(
				mcWithArgs(
					&KB{
						Command: "groog.ctrlG",
						Async:   async(true),
					},
					kb("termin-all-or-nothing.closePanel"),
				),
				mcWithArgs(
					&KB{
						Command: "groog.ctrlG",
						Async:   async(true),
					},
					kb("termin-all-or-nothing.openPanel"),
				),
			),
		),
		// alt-t on QMK keyboard is actually ctrl+shift+t (for new tab)
		ctrl(shift("t")): altT(),
		alt("t"):         altT(),
		alt(shift("t")):  only("workbench.action.terminal.newWithProfile"),
		// Ctrl+x ctrl+c isn't sent to terminal directly, so we need to
		// explicitly send the sequence.
		// See below link for unicode characters:
		// https://en.wikipedia.org/wiki/List_of_Unicode_characters
		// ctrlX("c"): panelSplit(sendSequence("\u0018\u0003"), nil),
		ctrlX("c"): panelSplit(
			mcWithArgs(
				kb("workbench.action.terminal.copyLastCommandOutput"),
				kb("groog.trimClipboard"),
				notification("Terminal output copied!"),
			),
			kb("groog-remote.copyFilePath"),
		),
		ctrlZ("c"): only("groog-remote.copyFileLink"),

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
		ctrlX("i"):       only("groog.copyImport"),
		ctrlZ("i"):       only("editor.action.organizeImports"),
		alt("i"):         only("groog.indentToPreviousLine"),
		alt(shift("i")): {
			always.value():          kb("groog.indentToNextLine"),
			editorTextFocus.value(): kb("-editor.action.insertCursorAtEndOfEachLineSelected"),
		},

		// Pasting
		ctrlX("y"): paste(),
		// ctrl+x ctrl+y on qmk keyboard
		ctrl("x shift+insert"): paste(),
		alt("y"):               paste(),

		// Settings
		ctrl(","): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openGlobalKeybindings",
			),
			kb("workbench.action.openGlobalKeybindings"),
		),
		ctrlX(","): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openGlobalKeybindingsFile",
			),
			kb("workbench.action.openGlobalKeybindingsFile"),
		),
		ctrl("."): panelSplit(
			mc(
				"workbench.action.closePanel",
				"workbench.action.openSettings",
			),
			kb("workbench.action.openSettings"),
		),
		ctrlX("."): panelSplit(
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
		alt("z"):    only("git.revertSelectedRanges"),
		ctrlZ("b"):  only("gitlens.toggleLineBlame"),
		ctrlZ(left): only("gitlens.toggleLineBlame"),
		alt("p"): {
			always.value():                kb("workbench.action.editor.previousChange"),
			notebookEditorFocused.value(): kb("notebook.focusPreviousEditor"),
		},
		alt("n"): {
			always.value():                kb("workbench.action.editor.nextChange"),
			notebookEditorFocused.value(): kb("notebook.focusNextEditor"),
		},

		// Errors (like git ones with addition of shift modifier).
		alt(shift("p")): {
			notebookEditorFocused.value(): kb("notebook.cell.insertCodeCellAbove"),
			always.value():                mc("editor.action.marker.prevInFiles", "closeMarkersNavigation"),
		},
		alt(shift("n")): {
			notebookEditorFocused.value(): kb("notebook.cell.insertCodeCellBelow"),
			always.value():                mc("editor.action.marker.nextInFiles", "closeMarkersNavigation"),
		},
		alt(shift("m")): onlyKBWhen(kb("notebook.cell.insertMarkdownCellBelow"), notebookEditorFocused),

		ctrlZ("y"): only("groog.toggleYesNoTest"),
		ctrlZ("t"): only("groog.toggleFixedTestFile"),
		ctrlX("t"): {
			goFile.value(): mcWithArgs(
				&KB{
					Command: "termin-all-or-nothing.execute",
					Args: map[string]interface{}{
						"command": "go.test.package",
					},
				},
			),
			// For all other file types, use the custom function
			and(notGoFile, activePanel).value(): mcWithArgs(
				&KB{
					Command: "groog.testFile",
					Args: map[string]interface{}{
						"part": 2,
					},
				},
				// If active panel, don't toggle the panel
			),
			and(notGoFile, activePanel.not()).value(): mcWithArgs(
				&KB{
					Command: "groog.testFile",
					Args: map[string]interface{}{
						"part": 0,
					},
				},
				&KB{
					Command: "groog.testFile",
					Delay:   delay(25),
					Args: map[string]interface{}{
						"part": 1,
					},
				},
			),
		},

		// Miscellaneous
		alt("v"):   only("coverage-gutters.toggleCoverage"),
		ctrlX("r"): only("workbench.action.reloadWindow"),
		// Sometimes hit alt+g on qmk keyboard. This binding
		// ensures we don't change focus to the menu bar (File, Edit, ...).
		alt("g"):   only("noop"),
		ctrlX("o"): only("workbench.action.openRecent"),

		alt("l"): {
			editorFocus.value(): kb("editor.action.selectHighlights"),
		},

		ctrlZ("k"): only("groog.toggleQMK"),
		ctrlX("e"): onlyMC(
			"workbench.view.extensions",
			"workbench.extensions.action.checkForUpdates",
		),
		// Prevent focus mode from ever being activated.
		ctrl("m"): only("-editor.action.toggleTabFocusMode"),
		escape:    onlyKBWhen(kb("groog.ctrlG"), groogTerminalFindMode),
	}
)

type KB struct {
	Command string                 `json:"command"`
	Args    map[string]interface{} `json:"args,omitempty"`
	// This is for multi-command (it's a pointer so omitempty works)
	Async *bool `json:"async,omitempty"`
	Delay *int  `json:"delay,omitempty"`
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

func onlyWhen(command string, context WhenContext) map[string]*KB {
	return onlyWhenArgs(command, context, nil)
}

func onlyWhenArgs(command string, context WhenContext, args map[string]interface{}) map[string]*KB {
	return onlyKBWhen(kbArgs(command, args), context)
}

func onlyKB(kb *KB) map[string]*KB {
	return onlyKBWhen(kb, always)
}

func onlyKBWhen(kb *KB, context WhenContext) map[string]*KB {
	return map[string]*KB{
		context.value(): kb,
	}
}

func kb(cmd string) *KB {
	return kbArgs(cmd, nil)
}

func onlyMC(cmds ...string) map[string]*KB {
	return onlyKB(mc(cmds...))
}

func notification(message string) *KB {
	return kbArgs("groog.message.info", map[string]interface{}{
		"message": message,
	})
}

func errorNotification(message string) *KB {
	return kbArgs("groog.message.info", map[string]interface{}{
		"message": message,
		"error":   true,
	})
}

func mcWithArgs(cmds ...*KB) *KB {
	return kbArgs("groog.multiCommand.execute", map[string]interface{}{
		"sequence": cmds,
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

	// Leader key duplication ([ctrl+x n] => [ctrl+x n]; [ctrl+x ctrl+n])
	if alias, ok := popLeader(k); ok {
		kas = append(kas, alias)
	}

	return kas
}

func findToggler(suffix string, context WhenContext, m map[string]*KB) map[string]*KB {
	groogCmd := fmt.Sprintf("groog.find.toggle%s", suffix)
	gc := and(inQuickOpen, groogFindMode)
	var se WhenContext = inSearchEditor
	var sv WhenContext = searchViewletFocus
	neg := and(groogFindMode.not(), inSearchEditor.not(), searchViewletFocus.not())
	if context != nil {
		gc = and(context, gc)
		se = and(context, se)
		sv = and(context, sv)
		neg = and(context, neg)
	}
	r := map[string]*KB{
		gc.value():  kb(groogCmd),
		se.value():  kb(fmt.Sprintf("toggleSearchEditor%s", suffix)),
		sv.value():  kb(fmt.Sprintf("toggleSearch%s", suffix)),
		neg.value(): kb(fmt.Sprintf("toggleSearch%s", suffix)),
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
func contextualKB(context WhenContext, trueKB, falseKB *KB) map[string]*KB {
	contextKey := context.value()
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

// panelSplit runs panelKB if the panel is active (i.e. visible) (so it may or
// may not be focused), and otherKB otherwise.
func panelSplit(panelKB, otherKB *KB) map[string]*KB {
	return contextualKB(activePanel, panelKB, otherKB)
}

func terminalPanelSplit(terminalKB, panelKB, otherKB *KB) map[string]*KB {
	return map[string]*KB{
		terminalFocus.value():                        terminalKB,
		and(panelFocus, terminalFocus.not()).value(): panelKB,
		panelFocus.not().value():                     otherKB,
	}
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
	return ctrlLeader("x", c)
}

func ctrlZ(c string) Key {
	return ctrlLeader("z", c)
}

func ctrlLeader(leader, c string) Key {
	return Key(fmt.Sprintf("ctrl+%s %s", leader, c))
}

var (
	leaderRgx = regexp.MustCompile(`^(ctrl\+[a-z0-9]) (.+)$`)
)

func popLeader(k Key) (string, bool) {
	m := leaderRgx.FindStringSubmatch(k.ToString())
	if len(m) == 0 {
		return "", false
	}
	return fmt.Sprintf("%s ctrl+%s", m[1], m[2]), true
}

func repeat(c string, times int) []string {
	var r []string
	for ; times > 0; times-- {
		r = append(r, c)
	}
	return r
}

/***************************************
 * key functions for multiple bindings *
 ***************************************/

func ctrlLBindings() map[string]*KB {
	return map[string]*KB{
		inQuickOpen.value(): mc(repeat("workbench.action.quickOpenNavigatePreviousInFilePicker", 5)...),
		and(inQuickOpen.not(), terminalFocus.not()).value(): kb("groog.jump"),
		// Sending this sequence sends the equivalent of pressing the page-up key while in the terminal.
		// See this stack overflow post: https://stackoverflow.com/questions/61742559/need-vscode-sendsequence-keybindings-for-previous-command-next-command-move-to
		// and this page that it links to (ctrl+f for "pageup"): https://invisible-island.net/xterm/ctlseqs/ctlseqs.html
		and(inQuickOpen.not(), terminalFocus).value(): sendSequence("\u001b[5~"),
	}
}

func ctrlVBindings() map[string]*KB {
	return map[string]*KB{
		inQuickOpen.value(): mc(repeat("workbench.action.quickOpenNavigateNextInFilePicker", 5)...),
		and(inQuickOpen.not(), terminalFocus.not()).value(): kb("groog.fall"),
		// See ctrlLBindings function for description of what this means
		and(inQuickOpen.not(), terminalFocus).value(): sendSequence("\u001b[6~"),
	}
}

const (
	superJump = 50
)

func ctrlShiftLBindings() map[string]*KB {
	return map[string]*KB{
		always.value(): kbArgs("groog.jump", map[string]interface{}{
			"lines": superJump,
		}),
	}
}

func ctrlShiftVBindings() map[string]*KB {
	return map[string]*KB{
		always.value(): kbArgs("groog.fall", map[string]interface{}{
			"lines": superJump,
		}),
	}
}

func upBindings() map[string]*KB {
	return map[string]*KB{
		groogTerminalFindMode.value(): kb("groog.terminal.reverseFind"),
		always.value():                kb("-workbench.action.quickOpen"),
		and(editorTextFocus, suggestWidgetVisible.not()).value(): kb("groog.cursorUp"),
		and(editorTextFocus, suggestWidgetVisible).value():       kb("selectPrevSuggestion"),
		inQuickOpen.value():        kb("workbench.action.quickOpenNavigatePreviousInFilePicker"),
		searchViewletFocus.value(): kb("list.focusUp"),
	}
}

func downBindings() map[string]*KB {
	return map[string]*KB{
		groogTerminalFindMode.value(): kb("groog.terminal.find"),
		always.value():                kb("-workbench.action.files.newUntitledFile"),
		and(editorTextFocus, suggestWidgetVisible.not()).value(): kb("groog.cursorDown"),
		and(editorTextFocus, suggestWidgetVisible).value():       kb("selectNextSuggestion"),
		inQuickOpen.value():         kb("workbench.action.quickOpenNavigateNextInFilePicker"),
		searchInputBoxFocus.value(): kb("search.action.focusSearchList"),
		and(searchInputBoxFocus.not(), searchViewletFocus).value(): kb("list.focusDown"),
	}
}

func leftBindings() map[string]*KB {
	return map[string]*KB{
		// "workbench.action.quickPickManyToggle" was removed because we want
		// left to just move the cursor in the quick open text to the left.
		and(editorTextFocus, inQuickOpen.not()).value(): kb("groog.cursorLeft"),
	}
}

func paste() map[string]*KB {
	return map[string]*KB{
		or(editorTextFocus, groogFindMode).value(): kb("groog.paste"),
		editorTextFocus.not().value():              kb("editor.action.clipboardPasteAction"),
	}
}

func prevTab() map[string]*KB {
	return terminalPanelSplit(
		kb("workbench.action.terminal.focusPrevious"),
		kb("workbench.action.terminal.focus"),
		kb("groog.focusPreviousEditor"),
	)
}

func nextTab() map[string]*KB {
	return terminalPanelSplit(
		kb("workbench.action.terminal.focusNext"),
		kb("workbench.action.terminal.focus"),
		kb("groog.focusNextEditor"),
	)
}

func altT() map[string]*KB {
	return panelSplit(
		kb("workbench.action.terminal.newInActiveWorkspace"),
		mcWithArgs(
			/** The below didn't work in wsl/ssh terminals :(
			&KB{
				Command: "workbench.action.terminal.runRecentCommand",
				Async:   async(true),
			},
			kb("workbench.action.acceptSelectedQuickOpenItem"),
			*/
			sendSequence("\u001b[A\u000d"),
			kb("terminal.focus"),
		),
	)
}

func merge(ms ...map[string]*KB) map[string]*KB {
	final := map[string]*KB{}
	for _, m := range ms {
		for k, v := range m {
			final[k] = v
		}
	}
	return final
}
