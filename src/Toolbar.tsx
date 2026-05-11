import { useState, useRef, useEffect } from 'react';
import { useStore } from './store';

const PRESET_COLORS = ['#2c2c2c', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#b0a89b'];
const FONT_SIZES = ['small', 'medium', 'large'];

export default function Toolbar() {
  const toggleBold = useStore((s) => s.toggleBold);
  const toggleItalic = useStore((s) => s.toggleItalic);
  const setColor = useStore((s) => s.setColor);
  const setFontSize = useStore((s) => s.setFontSize);
  const selection = useStore((s) => s.selection);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Compute active format from the selection
  const activeFormats = useStore((s) => s.activeFormats);

  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width === 0) { setPos(null); return; }
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    };

    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, []);

  // Also hide when selection becomes null/collapsed in store
  const visible = pos !== null && selection !== null &&
    (selection.anchor !== selection.focus || (selection.focusParagraphId && selection.focusParagraphId !== selection.paragraphId));

  return (
    <div
      className={`float-tb${visible ? ' visible' : ''}`}
      style={pos ? { left: pos.x, top: pos.y } : { display: 'none' }}
    >
      <button
        className={`tb-btn${activeFormats.bold ? ' active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggleBold(); }}
        title="粗体 (⌘B)"
      ><b>B</b></button>
      <button
        className={`tb-btn${activeFormats.italic ? ' active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggleItalic(); }}
        title="斜体 (⌘I)"
      ><i>I</i></button>

      <span className="tb-sep" />

      <ColorPicker current={activeFormats.color} onSelect={setColor} />
      <FontSizePicker current={activeFormats.fontSize} onSelect={setFontSize} />
    </div>
  );
}

function ColorPicker({ current, onSelect }: { current?: string; onSelect: (c: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const activeColor = current || '#2c2c2c';

  return (
    <div className="tb-color-picker" ref={ref}>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }} title="字体颜色">
        <span className="color-swatch" style={{ backgroundColor: activeColor }} />
      </button>
      {open && (
        <div className="color-dropdown">
          <div className="color-grid">
            {PRESET_COLORS.map((c) => (
              <div
                key={c}
                className={`color-chip${c === current ? ' selected' : ''}`}
                style={{ backgroundColor: c }}
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false); }}
              />
            ))}
          </div>
          <div className="color-custom-row">
            <input
              type="color"
              value={current || '#2c2c2c'}
              onChange={(e) => onSelect(e.target.value)}
            />
            <span className="color-custom-label">自定义</span>
          </div>
          {current && (
            <button className="color-clear" onMouseDown={(e) => { e.preventDefault(); onSelect(undefined); setOpen(false); }}>
              清除颜色
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FontSizePicker({ current, onSelect }: { current?: string; onSelect: (s: string | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const labels: Record<string, string> = { small: '小', medium: '中', large: '大' };

  const handleCustom = () => {
    if (custom && /^[\d.]+(em|px|pt|rem|%)?$/.test(custom)) {
      onSelect(custom);
      setOpen(false);
    }
  };

  return (
    <div className="tb-font-picker" ref={ref}>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }} title="字号">
        {current ? (labels[current] || current) : 'M'}
      </button>
      {open && (
        <div className="font-dropdown">
          {FONT_SIZES.map((s) => (
            <div
              key={s}
              className={`font-opt${s === current ? ' selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
            >
              <span style={{ fontSize: { small: '0.8em', medium: '1em', large: '1.5em' }[s] }}>
                {labels[s]}
              </span>
            </div>
          ))}
          <div className="font-custom-row">
            <input
              type="text"
              value={custom}
              placeholder="如 1.2em"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustom()}
            />
            <button onMouseDown={(e) => { e.preventDefault(); handleCustom(); }}>确定</button>
          </div>
          {current && (
            <button className="font-clear" onMouseDown={(e) => { e.preventDefault(); onSelect(undefined); setOpen(false); }}>
              清除字号
            </button>
          )}
        </div>
      )}
    </div>
  );
}
