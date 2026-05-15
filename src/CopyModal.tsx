import { useState, useEffect, useRef, useCallback } from 'react';
import type { Document } from './types';
import { renderDocToHtml } from './export';

interface Props {
  doc: Document;
  onClose: () => void;
}

export default function CopyModal({ doc, onClose }: Props) {
  const [tab, setTab] = useState<'clean' | 'trace'>('clean');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  const onOverlayDown = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKD);
    return () => window.removeEventListener('keydown', onKD);
  }, [onClose]);

  const html = renderDocToHtml(doc, tab);

  return (
    <div className="copy-modal-overlay" ref={overlayRef} onMouseDown={onOverlayDown}>
      <div className="copy-modal">
        <div className="copy-modal-header">
          <div className="copy-modal-tabs">
            <button
              className={`copy-modal-tab${tab === 'clean' ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setTab('clean'); }}
            >
              纯净文本
            </button>
            <button
              className={`copy-modal-tab${tab === 'trace' ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setTab('trace'); }}
            >
              留痕原文
            </button>
          </div>
          <button className="copy-modal-close" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>
            ✕
          </button>
        </div>
        <div
          className="copy-modal-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="copy-modal-hint">
          选中文字后 ⌘C 复制
        </div>
      </div>
    </div>
  );
}
