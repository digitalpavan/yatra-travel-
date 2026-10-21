import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Minimal, safe Markdown renderer. Produces React elements only (never raw
 * HTML), so any HTML in the source is shown as text. Supported syntax:
 * ## / ### headings, paragraphs, "-"/"*" and "1." lists, **bold**, *italic*
 * and [text](url) links (http(s), site-relative "/path" or "#anchor" only).
 */

type Block =
  | { type: "h2" | "h3" | "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING_RE.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      // The page title is the only <h1>; "#" and "##" map to h2, deeper levels to h3.
      blocks.push({ type: heading[1].length <= 2 ? "h2" : "h3", text: heading[2] });
      continue;
    }
    const ul = UL_RE.exec(line);
    const ol = ul ? null : OL_RE.exec(line);
    if (ul || ol) {
      flushParagraph();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    if (list) {
      // Continuation line of the previous list item.
      if (/^\s{2,}/.test(rawLine)) {
        list.items[list.items.length - 1] += ` ${line.trim()}`;
        continue;
      }
      flushList();
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Returns a safe href, or null if the URL scheme is not allowed. */
export function safeHref(url: string): { href: string; external: boolean } | null {
  const href = url.trim();
  if (/^https?:\/\/[^\s]+$/i.test(href)) return { href, external: true };
  if (/^\/(?![/\\])[^\s]*$/.test(href) || /^#[\w-]*$/.test(href)) return { href, external: false };
  return null;
}

const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const key = `${keyPrefix}-${i++}`;
    const [whole, linkText, linkUrl, bold1, bold2, em1, em2] = match;
    if (linkText !== undefined && linkUrl !== undefined) {
      const safe = safeHref(linkUrl);
      const children = renderInline(linkText, key);
      if (!safe) out.push(<span key={key}>{children}</span>);
      else if (safe.external)
        out.push(
          <a key={key} href={safe.href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>,
        );
      else
        out.push(
          <Link key={key} href={safe.href}>
            {children}
          </Link>,
        );
    } else if (bold1 !== undefined || bold2 !== undefined) {
      out.push(<strong key={key}>{renderInline(bold1 ?? bold2 ?? "", key)}</strong>);
    } else if (em1 !== undefined || em2 !== undefined) {
      out.push(<em key={key}>{renderInline(em1 ?? em2 ?? "", key)}</em>);
    } else {
      out.push(whole);
    }
    last = index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "prose-yatra" }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.type) {
          case "h2":
            return <h2 key={key}>{renderInline(block.text, key)}</h2>;
          case "h3":
            return <h3 key={key}>{renderInline(block.text, key)}</h3>;
          case "p":
            return <p key={key}>{renderInline(block.text, key)}</p>;
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={key}>
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
        }
      })}
    </div>
  );
}
