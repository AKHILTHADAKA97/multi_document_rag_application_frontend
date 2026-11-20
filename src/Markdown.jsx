import React from "react";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|\[(?:S\d+|\d+)\]|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function renderInline(text, onCitation, key) {
  if (!text) return null;
  // Clean up any trailing space before punctuation when preceded by citations (e.g. "[S1] [S2] ." -> "[S1] [S2].")
  const cleanText = String(text).replace(/(\[(?:S\d+|\d+)\])\s+([.,;:!?])/g, "$1$2");
  const parts = [];
  let last = 0;
  let match;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(cleanText)) !== null) {
    if (match.index > last) parts.push(cleanText.slice(last, match.index));
    const token = match[0];
    const k = `${key}-${parts.length}`;
    const citeMatch = token.match(/^\[(S?\d+)\]$/);
    if (citeMatch) {
      const id = citeMatch[1];
      parts.push(
        <button
          type="button"
          key={k}
          className="cite"
          onClick={() => onCitation?.(id)}
          aria-label={`Show source ${id}`}
          title={`Jump to Source [${id}]`}
        >
          {token}
        </button>,
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={k}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={k}>{token.slice(1, -1)}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      parts.push(
        <a key={k} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line || "") && (line || "").includes("-");
}

export default function Markdown({ text, onCitation }) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={`code-${i}`}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      const Tag = `h${Math.min(6, heading[1].length + 1)}`;
      blocks.push(
        <Tag key={`h-${i}`}>{renderInline(heading[2], onCitation, `h-${i}`)}</Tag>,
      );
      i += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div className="table-wrap" key={`table-${i}`}>
          <table>
            <thead>
              <tr>
                {header.map((cell, index) => (
                  <th key={index}>{renderInline(cell, onCitation, `th-${index}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_, cellIndex) => (
                    <td key={cellIndex}>
                      {renderInline(row[cellIndex] || "", onCitation, `td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item, onCitation, `li-${index}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item, onCitation, `oli-${index}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={`quote-${i}`}>
          {renderInline(quote.join(" "), onCitation, `quote-${i}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6}\s|[-*•]\s|\d+[.)]\s|>|```)/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    if (paragraph.length) {
      const key = `p-${i}`;
      blocks.push(<p key={key}>{renderInline(paragraph.join(" "), onCitation, key)}</p>);
    } else {
      i += 1;
    }
  }

  return <div className="markdown">{blocks}</div>;
}
