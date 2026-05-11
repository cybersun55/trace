import type { Paragraph, InlineNode } from './types';

interface Props {
  paragraph: Paragraph;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderNode(node: InlineNode): string {
  if (node.type === 'soft-break') {
    return '<span class="inline-soft-break" data-len="0">\u00B6</span>';
  }
  const cls = node.status === 'deleted' ? 'inline-text deleted' : 'inline-text';
  return `<span class="${cls}" data-len="${node.insert.length}">${escapeHtml(node.insert)}</span>`;
}

export default function ParagraphBlock({ paragraph }: Props) {
  const html = paragraph.children.length > 0
    ? paragraph.children.map(renderNode).join('')
    : '<span data-len="0">\u200B</span>';

  return (
    <div className="paragraph" data-pid={paragraph.id} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
