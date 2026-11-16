import React, { useMemo } from "react";
import katex from "katex";

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

type MathToken = {
  id: string;
  type: "block" | "inline";
  raw: string;
  formula: string;
};

/**
 * Universal Academic Math & Markdown Renderer:
 * - Detects Display Math: $$...$$, \[...\], \begin{...}...\end{...}
 * - Detects Inline Math: $...$, \(...\)
 * - Auto-detects standalone raw LaTeX formulas without delimiters (e.g. \vec{E} = \frac{...}{...})
 * - Renders Markdown structures: headers (#, ##, ###), bold (**text**), italic (*text*), code (`code`), lists (- or 1.), and blockquotes
 * - Prevents LaTeX underscores and asterisks from colliding with markdown syntax
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = "", inline = false }) => {
  const renderedOutput = useMemo(() => {
    if (!content || typeof content !== "string") return null;

    // Check if entire content is a pure raw LaTeX equation without dollar delimiters (and NOT an English sentence)
    const trimmed = content.trim();
    const withoutLatexCommands = trimmed.replace(/\\[a-zA-Z]+/g, "");
    const hasPlainEnglishWords = /\b[a-zA-Z]{4,}\s+[a-zA-Z]{3,}\b/.test(withoutLatexCommands) || trimmed.includes(": ");
    const isPureLatex =
      !trimmed.includes("$") &&
      !trimmed.includes("\\[") &&
      !hasPlainEnglishWords &&
      (/(\\[a-zA-Z]+|\^|_|\{|\}|\\times|\\cdot|\\frac|\\tau|\\vec|\\pi|\\epsilon|\\sigma|\\theta|\\int|\\sum)/.test(trimmed) &&
        !trimmed.includes("\n") &&
        trimmed.length < 180);

    if (isPureLatex) {
      try {
        const html = katex.renderToString(trimmed, {
          displayMode: !inline,
          throwOnError: false
        });
        if (inline) {
          return (
            <span
              className="inline-block max-w-full overflow-x-auto px-1 align-baseline text-inherit"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        return (
          <div
            className="my-2 max-w-full overflow-x-auto rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 py-2.5 text-center text-[#724060] shadow-xs"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        // Fallback to normal rendering if KaTeX parsing fails
      }
    }

    // Step 1: Extract and tokenize all math formulas
    const mathTokens: Map<string, MathToken> = new Map();
    let tokenIndex = 0;

    // Regex matching:
    // 1. $$ ... $$
    // 2. \[ ... \]
    // 3. \begin{equation/aligned/matrix} ... \end{...}
    // 4. \( ... \)
    // 5. $ ... $
    const mathRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\begin\{(?:aligned|align|equation|matrix|pmatrix|bmatrix|cases)\}[\s\S]*?\\end\{(?:aligned|align|equation|matrix|pmatrix|bmatrix|cases)\}|\\\([\s\S]*?\\\)|\$(?!\s)(?:\\.|[^\$\n\\])+?(?<!\s)\$)/g;

    const tokenizedText = content.replace(mathRegex, (match) => {
      const tokenId = `___MATH_TOKEN_${tokenIndex++}___`;

      if (match.startsWith("$$") && match.endsWith("$$")) {
        mathTokens.set(tokenId, {
          id: tokenId,
          type: "block",
          raw: match,
          formula: match.slice(2, -2).trim()
        });
      } else if (match.startsWith("\\[") && match.endsWith("\\]")) {
        mathTokens.set(tokenId, {
          id: tokenId,
          type: "block",
          raw: match,
          formula: match.slice(2, -2).trim()
        });
      } else if (match.startsWith("\\begin{") && match.includes("\\end{")) {
        mathTokens.set(tokenId, {
          id: tokenId,
          type: "block",
          raw: match,
          formula: match.trim()
        });
      } else if (match.startsWith("\\(") && match.endsWith("\\)")) {
        mathTokens.set(tokenId, {
          id: tokenId,
          type: "inline",
          raw: match,
          formula: match.slice(2, -2).trim()
        });
      } else if (match.startsWith("$") && match.endsWith("$")) {
        mathTokens.set(tokenId, {
          id: tokenId,
          type: "inline",
          raw: match,
          formula: match.slice(1, -1).trim()
        });
      } else {
        return match;
      }

      return tokenId;
    });

    const renderKatexToken = (tokenId: string, key: number | string) => {
      const token = mathTokens.get(tokenId);
      if (!token) return <span key={key}>{tokenId}</span>;

      try {
        const isBlock = token.type === "block" && !inline;
        const html = katex.renderToString(token.formula, {
          displayMode: isBlock,
          throwOnError: false
        });

        if (isBlock) {
          return (
            <div
              key={key}
              className="my-2.5 max-w-full overflow-x-auto rounded-xl border border-[#F8E7E7] bg-[#FDF3F3] px-3.5 py-2 text-center text-[#724060] shadow-xs"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={key}
            className="inline-block max-w-full overflow-x-auto px-1 align-baseline text-inherit"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return (
          <span key={key} className="font-mono text-xs text-red-500">
            {token.raw}
          </span>
        );
      }
    };

    // Helper to render text with inline math tokens and inline formatting (bold, italic, code)
    const renderInlineElements = (text: string, baseKey: number | string) => {
      // Split by math tokens and inline markdown
      const inlineRegex = /(___MATH_TOKEN_\d+___|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
      const segments = text.split(inlineRegex);

      return (
        <React.Fragment key={baseKey}>
          {segments.map((seg, idx) => {
            if (!seg) return null;

            if (seg.startsWith("___MATH_TOKEN_") && seg.endsWith("___")) {
              return renderKatexToken(seg, `${baseKey}-m-${idx}`);
            }

            if (seg.startsWith("**") && seg.endsWith("**") && seg.length >= 4) {
              return (
                <strong key={`${baseKey}-b-${idx}`} className="font-semibold text-inherit">
                  {renderInlineElements(seg.slice(2, -2), `${baseKey}-b-inner-${idx}`)}
                </strong>
              );
            }

            if (seg.startsWith("*") && seg.endsWith("*") && seg.length >= 2) {
              return (
                <em key={`${baseKey}-i-${idx}`} className="italic text-inherit">
                  {renderInlineElements(seg.slice(1, -1), `${baseKey}-i-inner-${idx}`)}
                </em>
              );
            }

            if (seg.startsWith("`") && seg.endsWith("`") && seg.length >= 2) {
              return (
                <code
                  key={`${baseKey}-c-${idx}`}
                  className="rounded bg-[#F8E7E7] px-1.5 py-0.5 font-mono text-[12px] text-[#724060]"
                >
                  {seg.slice(1, -1)}
                </code>
              );
            }

            return <span key={`${baseKey}-t-${idx}`}>{seg}</span>;
          })}
        </React.Fragment>
      );
    };

    // If inline mode requested, render inline directly
    if (inline) {
      return renderInlineElements(tokenizedText, "root-inline");
    }

    // Step 2: Block-level markdown parsing (paragraphs, lists, headings, code blocks)
    const lines = tokenizedText.split("\n");
    const blocks: React.ReactNode[] = [];
    let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeLanguage = "";

    const flushList = () => {
      if (currentList) {
        const ListTag = currentList.type;
        const listItems = currentList.items;
        const key = `list-${blocks.length}`;
        blocks.push(
          <ListTag
            key={key}
            className={`my-2 space-y-1.5 pl-5 text-[13px] leading-6 text-inherit ${
              ListTag === "ul" ? "list-disc marker:text-[#A070A1]" : "list-decimal marker:font-bold marker:text-[#A070A1]"
            }`}
          >
            {listItems.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInlineElements(item, `${key}-item-${itemIdx}`)}</li>
            ))}
          </ListTag>
        );
        currentList = null;
      }
    };

    const flushCodeBlock = () => {
      if (inCodeBlock) {
        const codeText = codeBuffer.join("\n");
        const key = `code-${blocks.length}`;
        blocks.push(
          <pre
            key={key}
            className="my-3 overflow-x-auto rounded-xl border border-[#F8E7E7] bg-[#2d1b26] p-4 text-[12.5px] font-mono text-[#FDF3F3] shadow-sm"
          >
            <code>{codeText}</code>
          </pre>
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLanguage = "";
      }
    };

    lines.forEach((line, lineIdx) => {
      // Code block start / end
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
          flushList();
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeBuffer = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        flushList();
        return;
      }

      // Check if line is ONLY a math block token
      const matchOnlyToken = trimmed.match(/^___MATH_TOKEN_(\d+)___$/);
      if (matchOnlyToken) {
        flushList();
        blocks.push(renderKatexToken(trimmed, `math-line-${lineIdx}`));
        return;
      }

      // Headers (# through ######)
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const headerText = headerMatch[2];
        if (level === 1) {
          blocks.push(
            <h2 key={`h1-${lineIdx}`} className="mt-6 mb-3 text-[19px] font-extrabold text-inherit">
              {renderInlineElements(headerText, `h1-inner-${lineIdx}`)}
            </h2>
          );
        } else if (level === 2) {
          blocks.push(
            <h3 key={`h2-${lineIdx}`} className="mt-5 mb-2 text-[17px] font-bold text-inherit">
              {renderInlineElements(headerText, `h2-inner-${lineIdx}`)}
            </h3>
          );
        } else if (level === 3) {
          blocks.push(
            <h4 key={`h3-${lineIdx}`} className="mt-4 mb-2 text-[15px] font-bold text-inherit">
              {renderInlineElements(headerText, `h3-inner-${lineIdx}`)}
            </h4>
          );
        } else {
          blocks.push(
            <h5 key={`h4-${lineIdx}`} className="mt-3.5 mb-1.5 text-[14px] font-bold text-inherit">
              {renderInlineElements(headerText, `h4-inner-${lineIdx}`)}
            </h5>
          );
        }
        return;
      }

      // Unordered list (- or * )
      const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      if (ulMatch) {
        if (!currentList || currentList.type !== "ul") {
          flushList();
          currentList = { type: "ul", items: [] };
        }
        currentList.items.push(ulMatch[2]);
        return;
      }

      // Ordered list (1. 2. etc.)
      const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (olMatch) {
        if (!currentList || currentList.type !== "ol") {
          flushList();
          currentList = { type: "ol", items: [] };
        }
        currentList.items.push(olMatch[2]);
        return;
      }

      // Blockquote (> )
      if (trimmed.startsWith("> ")) {
        flushList();
        blocks.push(
          <blockquote
            key={`quote-${lineIdx}`}
            className="my-3 border-l-4 border-[#A070A1] bg-[#FDF3F3] p-3 text-[13px] italic leading-6 text-inherit"
          >
            {renderInlineElements(trimmed.slice(2), `quote-inner-${lineIdx}`)}
          </blockquote>
        );
        return;
      }

      // Regular paragraph line
      flushList();
      blocks.push(
        <p key={`p-${lineIdx}`} className="my-1.5 text-[13.5px] leading-6 text-inherit">
          {renderInlineElements(line, `p-inner-${lineIdx}`)}
        </p>
      );
    });

    flushList();
    flushCodeBlock();

    return blocks;
  }, [content, inline]);

  if (inline) {
    return <span className={`inline-math-container max-w-full break-words text-inherit ${className}`}>{renderedOutput}</span>;
  }

  return <div className={`math-markdown-content min-w-0 max-w-full break-words text-inherit ${className}`}>{renderedOutput}</div>;
};

export default MathRenderer;
