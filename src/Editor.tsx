import { memo, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from './store';
import { loadSettings } from './settings';
import ParagraphBlock from './ParagraphBlock';
import Toolbar from './Toolbar';
import { exportTracebook, exportTextFile } from './storage';
import { exportPlainText } from './export';

// Flag to block selection sync while innerHTML is being reset and cursor not yet restored.
// Set synchronously when document mutates, cleared after cursor restoration effect runs.
let pendingCursorRestore = false;

export default memo(function Editor() {
  const ref = useRef<HTMLDivElement>(null);
  const doc = useEditorStore((s) => s.document);
  // Selection is NOT subscribed here — reading it would trigger re-renders
  // on every selection change, destroying the browser's native DOM selection.
  // Store functions read it via getState(); cursor restoration reads it below.

  const setSelection = useEditorStore((s) => s.setSelection);
  const storeInsert = useEditorStore((s) => s.insertText);
  const storeSoft = useEditorStore((s) => s.softDelete);
  const storeHard = useEditorStore((s) => s.hardDelete);
  const storeSplit = useEditorStore((s) => s.splitParagraph);
  const storeComposeSet = useEditorStore((s) => s.setIsComposing);
  const storeToggleHide = useEditorStore((s) => s.toggleHideDeleted);
  const storeToggleBold = useEditorStore((s) => s.toggleBold);
  const storeToggleItalic = useEditorStore((s) => s.toggleItalic);
  const storeUndo = useEditorStore((s) => s.undo);
  const storeRedo = useEditorStore((s) => s.redo);
  const hideDeleted = useEditorStore((s) => s.hideDeleted);

  const shiftRef = useRef(false);
  const metaRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onKD = (e: KeyboardEvent) => {
      // Safety: reset stuck isComposing if keydown fires without composing
      if (!e.isComposing) storeComposeSet(false);
      shiftRef.current = e.shiftKey;
      metaRef.current = e.metaKey || e.ctrlKey;

      console.log('[keydown]', e.key, 'shift:', e.shiftKey, 'meta:', metaRef.current, 'composing:', e.isComposing);

      const mod = e.metaKey || e.ctrlKey;

      // Undo / Redo (always available, not configurable)
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        storeUndo();
        return;
      }
      if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        storeRedo();
        return;
      }

      const settings = loadSettings();
      const scuts = settings.shortcuts;

      // Look up shortcut config: key + modifiers match
      const match = scuts.find((sc) => {
        const scMod = sc.ctrlKey;
        const scShift = sc.shiftKey;
        const keyMatch = e.key === sc.key || e.key.toLowerCase() === sc.key.toLowerCase();
        return keyMatch && mod === scMod && e.shiftKey === scShift && !['Control', 'Shift', 'Meta', 'Alt'].includes(e.key);
      });

      if (match) {
        switch (match.id) {
          case 'toggleHideDeleted': e.preventDefault(); storeToggleHide(); return;
          case 'toggleBold': {
            e.preventDefault();
            const sel = useEditorStore.getState().selection;
            // Only guard when selection is non-collapsed (doc will change via applyFormatToSelection)
            pendingCursorRestore = sel ? (sel.anchor !== sel.focus || (!!sel.focusParagraphId && sel.focusParagraphId !== sel.paragraphId)) : false;
            storeToggleBold();
            return;
          }
          case 'toggleItalic': {
            e.preventDefault();
            const sel = useEditorStore.getState().selection;
            pendingCursorRestore = sel ? (sel.anchor !== sel.focus || (!!sel.focusParagraphId && sel.focusParagraphId !== sel.paragraphId)) : false;
            storeToggleItalic();
            return;
          }
          case 'hardDelete':
            e.preventDefault();
            pendingCursorRestore = true;
            useEditorStore.getState().hardDelete();
            return;
          default:
            // softDelete, splitParagraph are handled by beforeinput
            break;
        }
      }

      // Quick save: Ctrl+S (not in user shortcuts, always available)
      if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        exportTracebook(useEditorStore.getState().document);
        return;
      }

      if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        exportTextFile(exportPlainText(useEditorStore.getState().document), '写作（纯净）.txt');
        return;
      }
    };

    const onKU = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      metaRef.current = e.metaKey || e.ctrlKey;
    };
    const onDocKD = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')
        console.log('[doc-keydown]', e.key, 'shift:', e.shiftKey, 'target:', (e.target as HTMLElement)?.tagName);
    };

    el.addEventListener('keydown', onKD, true);
    document.addEventListener('keyup', onKU);
    document.addEventListener('keydown', onDocKD);
    return () => {
      el.removeEventListener('keydown', onKD, true);
      document.removeEventListener('keyup', onKU);
      document.removeEventListener('keydown', onDocKD);
    };
  }, []);

  // Intercept beforeinput to prevent browser from modifying DOM
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onBeforeInput = (e: InputEvent) => {
      const state = useEditorStore.getState();

      console.log('[beforeinput]', e.inputType, 'shiftRef:', shiftRef.current, 'composing:', e.isComposing || state.isComposing);

      if (e.isComposing || state.isComposing) return;

      e.preventDefault();
      pendingCursorRestore = true;

      switch (e.inputType) {
        case 'insertText':
          if (e.data) state.insertText(e.data);
          break;
        case 'deleteContentBackward':
          if (metaRef.current) state.hardDelete();
          else state.softDelete('backward');
          break;
        case 'deleteContentForward':
          if (metaRef.current) state.hardDelete();
          else state.softDelete('forward');
          break;
        case 'insertParagraph':
          state.splitParagraph();
          break;
        case 'insertFromPaste': {
          const text = e.data || e.dataTransfer?.getData('text/plain');
          if (text) {
            const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const lines = normalized.split('\n');
            state.insertText(lines[0]);
            for (let i = 1; i < lines.length; i++) {
              state.splitParagraph();
              state.insertText(lines[i]);
            }
          }
          break;
        }
      }
    };

    el.addEventListener('beforeinput', onBeforeInput, true);
    return () => el.removeEventListener('beforeinput', onBeforeInput, true);
  }, []);

  // Cursor / selection restoration (only on document change, not on selection change)
  useEffect(() => {
    const sel = useEditorStore.getState().selection;
    if (!sel) { pendingCursorRestore = false; return; }
    const el = ref.current;
    if (!el) { pendingCursorRestore = false; return; }

    // Cross-paragraph: leave the browser's native selection alone
    const isMulti = sel.focusParagraphId && sel.focusParagraphId !== sel.paragraphId;
    if (isMulti) { pendingCursorRestore = false; return; }

    const block = el.querySelector(`[data-pid="${sel.paragraphId}"]`) as HTMLElement | null;
    if (!block) { pendingCursorRestore = false; return; }

    if (sel.anchor === sel.focus) {
      const pos = findDOMPosition(block, sel.focus);
      if (!pos) { pendingCursorRestore = false; return; }
      const r = document.createRange();
      r.setStart(pos.node, pos.offset);
      r.collapse(true);
      applyRange(r);
      pendingCursorRestore = false;
      return;
    }

    // Non-collapsed within same paragraph: restore with correct direction
    const anchorPos = findDOMPosition(block, sel.anchor);
    const focusPos = findDOMPosition(block, sel.focus);
    if (!anchorPos || !focusPos) { pendingCursorRestore = false; return; }

    window.getSelection()?.setBaseAndExtent(
      anchorPos.node, anchorPos.offset,
      focusPos.node, focusPos.offset,
    );
    pendingCursorRestore = false;
  }, [doc]);

  function findParagraphBlock(node: Node): HTMLElement | null {
    const el = ref.current;
    if (!el) return null;
    let cur: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement;
    while (cur && cur !== el) {
      if (cur.hasAttribute('data-pid')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function syncSelection() {
    if (pendingCursorRestore) return;
    const domSel = window.getSelection();
    if (!domSel || domSel.rangeCount === 0) return;
    const el = ref.current;
    if (!el) return;
    const aNode = domSel.anchorNode;
    const fNode = domSel.focusNode;
    if (!aNode || !fNode || !el.contains(aNode) || !el.contains(fNode)) return;

    const anchorBlock = findParagraphBlock(aNode);
    const focusBlock = findParagraphBlock(fNode);
    if (!anchorBlock || !focusBlock) return;

    const pid = anchorBlock.getAttribute('data-pid')!;
    const fPid = focusBlock.getAttribute('data-pid')!;
    const anchor = getFlatOffset(anchorBlock, aNode, domSel.anchorOffset);
    const focus = getFlatOffset(focusBlock, fNode, domSel.focusOffset);
    if (anchor === null || focus === null) return;

    setSelection({
      paragraphId: pid,
      anchor,
      focus,
      focusParagraphId: fPid !== pid ? fPid : undefined,
    });
  }

  // selectionchange keeps store in sync with DOM for ALL selection methods
  // (Cmd+A, Shift+Click, drag, etc.), not just mouseUp/keyUp.
  useEffect(() => {
    const onSelChange = () => {
      if (useEditorStore.getState().isComposing) return;
      // Ignore selection changes when editor doesn't have focus —
      // the browser (especially on Windows IME) may reset selection
      // to the beginning of contentEditable while idle.
      if (!ref.current?.contains(document.activeElement)) return;
      syncSelection();
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  function handleKeyUp(e: React.KeyboardEvent) {
    if (/^(Arrow|Home|End|Page)/.test(e.key)) {
      syncSelection();
    }
  }

  const onCompositionStart = useCallback(() => storeComposeSet(true), [storeComposeSet]);
  const onCompositionEnd = useCallback((e: React.CompositionEvent) => {
    storeComposeSet(false);
    if (e.data) {
      pendingCursorRestore = true;
      storeInsert(e.data);
    }
  }, [storeComposeSet, storeInsert]);

  return (
    <div
      ref={ref}
      className={`editor${hideDeleted ? ' hide-deleted' : ''}`}
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      onMouseUp={syncSelection}
      onKeyUp={handleKeyUp}
      spellCheck={false}
    >
      {doc.paragraphs.map((p) => (
        <ParagraphBlock key={p.id} paragraph={p} />
      ))}
      <Toolbar />
    </div>
  );
});

// ==== helpers ====

function getFlatOffset(block: HTMLElement, node: Node, nodeOffset: number): number | null {
  let total = 0;
  for (const span of block.children) {
    const len = Number((span as HTMLElement).dataset.len) || 0;
    if (span === node || span.contains(node)) return total + nodeOffset;
    total += len;
  }
  // Cursor directly in the paragraph div (between spans or empty paragraph)
  if (node === block) {
    let flat = 0;
    for (let i = 0; i < nodeOffset && i < block.children.length; i++) {
      flat += Number((block.children[i] as HTMLElement).dataset.len) || 0;
    }
    return flat;
  }
  return null;
}
function findDOMPosition(block: HTMLElement, flatOffset: number): { node: Node; offset: number } | null {
  let acc = 0;
  for (const span of block.children) {
    const len = Number((span as HTMLElement).dataset.len) || 0;
    if (len === 0) {
      if (flatOffset === acc) {
        const parent = span.parentNode!;
        const idx = Array.from(parent.childNodes).indexOf(span);
        return { node: parent, offset: idx + 1 };
      }
      continue;
    }
    const end = acc + len;
    if (flatOffset <= end) {
      const tn = span.firstChild!;
      return { node: tn, offset: flatOffset - acc };
    }
    acc = end;
  }
  // After all spans
  const last = block.lastElementChild;
  if (last) {
    const parent = last.parentNode!;
    const idx = Array.from(parent.childNodes).indexOf(last);
    return { node: parent, offset: idx + 1 };
  }
  return { node: block, offset: 0 };
}
function applyRange(range: Range) {
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
