// 마크다운 → HTML 변환기. DOM에 의존하지 않는 순수 함수만 둡니다.
// parseMarkdown(text) → { meta, html }

const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])( +)(.*)$/;
const HEADING_RE = /^ {0,3}(#{1,6})(?: +(.*?))?(?: +#+)? *$/;
const HR_RE = /^ {0,3}([-*_])( *\1){2,} *$/;
const FENCE_RE = /^( *)(`{3,}|~{3,}) *([\w+#.-]*)[^`]*$/;
const QUOTE_RE = /^ {0,3}> ?(.*)$/;
const TABLE_SEP_RE = /^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;
const PLACEHOLDER_RE = /\u0000(\d+)\u0000/g;
// 링크 주소: 괄호 한 단계까지 허용 (예: 위키백과 주소)
const URL_PART = '((?:[^\\s()]|\\([^\\s()]*\\))+)';
const TITLE_PART = '(?:\\s+&quot;(.*?)&quot;)?';
const IMAGE_RE = new RegExp(`!\\[([^\\]]*)\\]\\(\\s*${URL_PART}${TITLE_PART}\\s*\\)`, 'g');
const LINK_RE = new RegExp(`\\[([^\\]]+)\\]\\(\\s*${URL_PART}${TITLE_PART}\\s*\\)`, 'g');

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// http(s), mailto, 상대 경로만 허용하고 나머지(javascript: 등)는 막습니다.
export function safeUrl(url) {
  const cleaned = String(url).replace(/[\u0000- \u007f]/g, '');
  const scheme = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^(https?|mailto)$/i.test(scheme[1])) return '#';
  return cleaned;
}

export function parseMarkdown(text) {
  const source = String(text ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\t/g, '    ');

  const { meta, body } = splitFrontMatter(source);
  const ctx = { ids: new Map() };
  const html = parseBlocks(body.split('\n'), ctx, false);
  return { meta, html };
}

/* ---------- front matter ---------- */

function splitFrontMatter(source) {
  const meta = {};
  if (!source.startsWith('---\n')) return { meta, body: source };

  const end = source.indexOf('\n---', 4);
  if (end === -1) return { meta, body: source };

  const lineEnd = source.indexOf('\n', end + 4);
  const body = lineEnd === -1 ? '' : source.slice(lineEnd + 1);

  for (const line of source.slice(4, end).split('\n')) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    const list = value.match(/^\[(.*)\]$/);
    meta[m[1]] = list
      ? list[1].split(',').map(stripQuotes).filter(Boolean)
      : unquote(value);
  }
  return { meta, body };
}

// 따옴표 없는 true/false는 불리언으로 읽습니다. (예: draft: true)
function unquote(value) {
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return stripQuotes(v);
}

function stripQuotes(value) {
  const v = value.trim();
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

/* ---------- 블록 ---------- */

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function isBlank(line) {
  return /^\s*$/.test(line);
}

function isTableStart(lines, i) {
  return (
    i + 1 < lines.length &&
    lines[i].includes('|') &&
    lines[i + 1].includes('|') &&
    TABLE_SEP_RE.test(lines[i + 1])
  );
}

// 문단을 끊는 블록인지 확인합니다.
function startsBlock(lines, i) {
  const line = lines[i];
  return (
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

function parseBlocks(lines, ctx, tight) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // 코드 블록
    const fence = line.match(FENCE_RE);
    if (fence) {
      const [, indent, marker, lang] = fence;
      const close = new RegExp(`^ *\\${marker[0]}{${marker.length},} *$`);
      const body = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        body.push(lines[i].slice(Math.min(indent.length, indentOf(lines[i]))));
        i++;
      }
      i++; // 닫는 줄 건너뛰기
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // 제목
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const content = heading[2] || '';
      const id = uniqueId(content, ctx);
      out.push(`<h${level} id="${escapeHtml(id)}">${inline(content)}</h${level}>`);
      i++;
      continue;
    }

    // 수평선 (목록보다 먼저 확인)
    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 인용문
    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i].match(QUOTE_RE)[1]);
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(inner, ctx, false)}\n</blockquote>`);
      continue;
    }

    // 목록
    if (LIST_RE.test(line)) {
      const result = parseList(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // 표
    if (isTableStart(lines, i)) {
      const result = parseTable(lines, i);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // 문단
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines, i))) {
      para.push(lines[i].replace(/^ +/, ''));
      i++;
    }
    const content = inline(para.join('\n').replace(/ +$/, ''));
    out.push(tight ? content : `<p>${content}</p>`);
  }

  return out.join('\n');
}

function parseList(lines, start, ctx) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  // 기호가 바뀌면(- → *, 1. → 1)) 새 목록으로 봅니다.
  const markerKind = (marker) => (/\d/.test(marker) ? marker.slice(-1) : marker);
  const kind = markerKind(first[2]);
  const items = [];
  let loose = false;
  let i = start;

  const isSibling = (line) => {
    const m = line.match(LIST_RE);
    return m && m[1].length === baseIndent && markerKind(m[2]) === kind && !HR_RE.test(line);
  };

  while (i < lines.length && isSibling(lines[i])) {
    const m = lines[i].match(LIST_RE);
    const contentIndent = m[1].length + m[2].length + m[3].length;
    const itemLines = [m[4]];
    i++;

    while (i < lines.length) {
      const line = lines[i];

      if (isBlank(line)) {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j >= lines.length) {
          i = j;
          break;
        }
        if (indentOf(lines[j]) > baseIndent) {
          // 항목 안에서 문단이 이어집니다.
          for (let k = i; k < j; k++) itemLines.push('');
          loose = true;
          i = j;
          continue;
        }
        if (isSibling(lines[j])) {
          loose = true;
          i = j;
        }
        break;
      }

      const indent = indentOf(line);
      if (indent > baseIndent) {
        itemLines.push(line.slice(Math.min(indent, contentIndent)));
        i++;
        continue;
      }
      if (startsBlock(lines, i)) break;
      itemLines.push(line.trim()); // 들여쓰지 않은 이어지는 줄
      i++;
    }

    items.push(itemLines);
  }

  let hasTask = false;
  const lis = items.map((itemLines) => {
    const task = itemLines[0].match(/^\[([ xX])\] +(.*)$/);
    let prefix = '';
    if (task) {
      hasTask = true;
      itemLines[0] = task[2];
      const checked = task[1] !== ' ' ? ' checked' : '';
      prefix = `<input type="checkbox" disabled${checked}> `;
    }
    const body = parseBlocks(itemLines, ctx, !loose);
    return task ? `<li class="task-item">${prefix}${body}</li>` : `<li>${body}</li>`;
  });

  const tag = ordered ? 'ol' : 'ul';
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const attrs = [];
  if (ordered && startNum !== 1) attrs.push(` start="${startNum}"`);
  if (hasTask) attrs.push(' class="task-list"');

  return {
    html: `<${tag}${attrs.join('')}>\n${lis.join('\n')}\n</${tag}>`,
    next: i,
  };
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row
    .replace(/\\\|/g, '\u0001')
    .split('|')
    .map((cell) => cell.replace(/\u0001/g, '|').trim());
}

function parseTable(lines, start) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });

  const cell = (tagName, text, col) => {
    const align = aligns[col] ? ` style="text-align:${aligns[col]}"` : '';
    return `<${tagName}${align}>${inline(text || '')}</${tagName}>`;
  };

  const head = header.map((text, col) => cell('th', text, col)).join('');
  const rows = [];
  let i = start + 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    rows.push(`<tr>${header.map((_, col) => cell('td', cells[col], col)).join('')}</tr>`);
    i++;
  }

  const body = rows.length ? `\n<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  return {
    html: `<div class="table-wrap"><table>\n<thead><tr>${head}</tr></thead>${body}\n</table></div>`,
    next: i,
  };
}

function uniqueId(text, ctx) {
  const base =
    text
      .replace(/[`*_~[\]()!]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'section';
  const count = ctx.ids.get(base) || 0;
  ctx.ids.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

/* ---------- 인라인 ---------- */

function inline(text) {
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = text;

  // 인라인 코드는 안쪽을 변환하지 않습니다.
  s = s.replace(/(`+)(.+?)\1/g, (_, ticks, code) => stash(`<code>${escapeHtml(code.trim())}</code>`));

  // 백슬래시 이스케이프
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_, ch) => stash(escapeHtml(ch)));

  // 줄 끝 공백 2칸 또는 백슬래시 → 줄바꿈
  s = s.replace(/(?: {2,}|\\)\n/g, () => `${stash('<br>')}\n`);

  s = escapeHtml(s);

  // 이미지
  s = s.replace(IMAGE_RE, (_, alt, src, title) => {
    const titleAttr = title ? ` title="${title}"` : '';
    return stash(`<img src="${safeUrl(src)}" alt="${alt}"${titleAttr} loading="lazy">`);
  });

  // 링크 (안쪽 텍스트는 계속 강조 처리를 받습니다)
  s = s.replace(LINK_RE, (_, label, href, title) => {
    const url = safeUrl(href);
    const titleAttr = title ? ` title="${title}"` : '';
    const external = /^https?:/i.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `${stash(`<a href="${url}"${titleAttr}${external}>`)}${label}${stash('</a>')}`;
  });

  // 강조
  s = s.replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>');
  // 밑줄은 한글·영문 단어 중간(snake_case, 변수_이름)에서는 강조로 보지 않습니다.
  s = s.replace(/(^|[^\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>');
  s = s.replace(/\*(?=[^\s*])(.+?)(?<=[^\s*])\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\p{L}\p{N}_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
  s = s.replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<del>$1</del>');

  // 보관해 둔 조각을 되돌립니다.
  return s.replace(PLACEHOLDER_RE, (_, index) => tokens[Number(index)]);
}
