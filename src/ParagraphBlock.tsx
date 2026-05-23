import type { Paragraph, InlineNode } from './types';

interface Props {
  paragraph: Paragraph;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fontSizeCSS(s: string): string {
  const map: Record<string, string> = { small: '0.8em', medium: '1em', large: '1.5em' };
  return map[s] || s;
}

function renderNode(node: InlineNode): string {
  if (node.type === 'soft-break') {
    return '<span class="inline-soft-break" data-len="0">\u00B6</span>';
  }
  const cls = node.status === 'deleted' ? 'inline-text deleted' : 'inline-text';
  const styles: string[] = [];
  if (node.attributes?.bold) styles.push('font-weight:bold');
  if (node.attributes?.italic) styles.push('font-style:italic');
  // Color is always suppressed for deleted spans — .deleted CSS controls it
  if (node.attributes?.color && node.status !== 'deleted') styles.push(`color:${node.attributes.color}`);
  if (node.attributes?.fontSize) styles.push(`font-size:${fontSizeCSS(node.attributes.fontSize)}`);
  const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
  return `<span class="${cls}" data-len="${node.insert.length}"${styleAttr}>${escapeHtml(node.insert)}</span>`;
}

export default function ParagraphBlock({ paragraph }: Props) {
  const html = paragraph.children.length > 0
    ? paragraph.children.map(renderNode).join('')
    : '<span data-len="0">\u200B</span>';

  const paraStyle = paragraph.lineHeight ? { lineHeight: paragraph.lineHeight } : undefined;

  return (
    <div className="paragraph" data-pid={paragraph.id} style={paraStyle} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
