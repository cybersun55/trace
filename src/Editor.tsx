import { useRef, useEffect, useCallback } from 'react';
import { useStore } from './store';
import ParagraphBlock from './ParagraphBlock';

export default function Editor() {
  const ref = useRef<HTMLDivElement>(null);
  const doc = useStore((s) => s.document);
  const selection = useStore((s) => s.selection);

  const setSelection = useStore((s) => s.setSelection);
  const storeInsert = useStore((s) => s.insertText);
  const storeSoft = useStore((s) => s.softDelete);
  const storeHard = useStore((s) => s.hardDelete);
  const storeSplit = useStore((s) => s.splitParagraph);
  const storeComposeSet = useStore((s) => s.setIsComposing);

  const shiftRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onKD = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
    };

    el.addEventListener('keydown', onKD, true);
    return () => el.removeEventListener('keydown', onKD, true);
  }, []);

  // Intercept beforeinput to prevent browser from modifying DOM
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onBeforeInput = (e: InputEvent) => {
      const state = useStore.getState();
      if (e.isComposing || state.isComposing) return;

      e.preventDefault();

      switch (e.inputType) {
        case 'insertText':
          if (e.data) state.insertText(e.data);
          break;
        case 'deleteContentBackward':
          if (shiftRef.current) state.hardDelete();
          else state.softDelete('backward');
          break;
        case 'deleteContentForward':
          state.softDelete('forward');
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

  // Cursor restoration
  useEffect(() => {
    if (!selection) return;
    const el = ref.current;
    if (!el) return;
    const block = el.querySelector(`[data-pid="${selection.paragraphId}"]`);
    if (!block) return;

    const target = selection.focus;
    let acc = 0;
    for (const span of block.children) {
      const len = Number((span as HTMLElement).dataset.len) || 0;
      if (len === 0) {
        if (target === acc) { placeAfter(span as HTMLElement); return; }
        continue;
      }
      const end = acc + len;
      if (target <= end) {
        const tn = span.firstChild!;
        const r = document.createRange();
        r.setStart(tn, target - acc);
        r.collapse(true);
        applyRange(r);
        return;
      }
      acc = end;
    }
    const last = block.lastElementChild;
    if (last && last.tagName === 'BR') {
      const r = document.createRange(); r.setStartBefore(last); r.collapse(true); applyRange(r);
    } else if (last) {
      placeAfter(last as HTMLElement);
    } else {
      const r = document.createRange(); r.setStart(block, 0); r.collapse(true); applyRange(r);
    }
  });

  function syncSelection() {
    const domSel = window.getSelection();
    if (!domSel || domSel.rangeCount === 0) return;
    const el = ref.current;
    if (!el) return;
    const aNode = domSel.anchorNode;
    if (!aNode || !el.contains(aNode)) return;

    let block: HTMLElement | null = aNode instanceof HTMLElement ? aNode : aNode.parentElement;
    while (block && block !== el) {
      if (block.hasAttribute('data-pid')) break;
      block = block.parentElement;
    }
    if (!block || block === el) return;

    const pid = block.getAttribute('data-pid')!;
    const anchor = getFlatOffset(block, domSel.anchorNode!, domSel.anchorOffset);
    const focus = getFlatOffset(block, domSel.focusNode!, domSel.focusOffset);
    if (anchor === null || focus === null) return;
    setSelection({ paragraphId: pid, anchor, focus });
  }

  // Only sync on navigation keys (not content-modifying keys) to avoid overwriting store selection
  function handleKeyUp(e: React.KeyboardEvent) {
    if (/^(Arrow|Home|End|Page)/.test(e.key)) {
      syncSelection();
    }
  }

  const onCompositionStart = useCallback(() => storeComposeSet(true), [storeComposeSet]);
  const onCompositionEnd = useCallback((e: React.CompositionEvent) => {
    storeComposeSet(false);
    if (e.data) storeInsert(e.data);
  }, [storeComposeSet, storeInsert]);

  return (
    <div
      ref={ref}
      className="editor"
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
    </div>
  );
}

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
function placeAfter(el: HTMLElement) {
  const r = document.createRange();
  r.setStartAfter(el);
  r.collapse(true);
  applyRange(r);
}
function applyRange(range: Range) {
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
