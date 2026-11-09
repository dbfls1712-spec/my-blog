// 해시 라우팅과 화면 렌더링
//   #/             글 목록
//   #/post/<slug>  글 본문
//   #/tag/<tag>    태그별 글 목록

import { parseMarkdown, escapeHtml } from './markdown.js';
import { initThemeToggle } from './theme.js';

const SITE_NAME = 'RIN';
const SLUG_RE = /^[a-z0-9-]+$/;

const app = document.getElementById('app');
let postsPromise = null;
let routeToken = 0;
let firstRender = true;

/* ---------- 데이터 ---------- */

function loadPosts() {
  if (!postsPromise) {
    postsPromise = fetch('posts/posts.json')
      .then((res) => {
        if (!res.ok) throw new Error(`posts.json: ${res.status}`);
        return res.json();
      })
      .then((list) =>
        list
          // draft: true인 글은 목록에 보이지 않습니다.
          .filter((post) => post && SLUG_RE.test(post.slug) && post.draft !== true)
          .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      )
      .catch((error) => {
        postsPromise = null; // 다음 이동 때 다시 시도
        throw error;
      });
  }
  return postsPromise;
}

async function loadPost(slug) {
  const res = await fetch(`posts/${slug}.md`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${slug}.md: ${res.status}`);
  return res.text();
}

/* ---------- 출력 도우미 ---------- */

function formatDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return escapeHtml(value || '');
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

function dateHtml(value) {
  if (!value) return '';
  return `<time datetime="${escapeHtml(value)}">${formatDate(value)}</time>`;
}

function tagsHtml(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return '';
  const items = tags
    .map((tag) => `<li><a class="tag" href="#/tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a></li>`)
    .join('');
  return `<ul class="tags" aria-label="태그">${items}</ul>`;
}

function postCardHtml(post) {
  const desc = post.description ? `<p class="post-card-desc">${escapeHtml(post.description)}</p>` : '';
  return `
    <li class="post-card">
      <article>
        <h2 class="post-card-title"><a href="#/post/${post.slug}">${escapeHtml(post.title || post.slug)}</a></h2>
        <p class="post-meta">${dateHtml(post.date)}</p>
        ${desc}
        ${tagsHtml(post.tags)}
      </article>
    </li>`;
}

function setTitle(title) {
  document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

function render(html) {
  app.innerHTML = html;
  app.removeAttribute('aria-busy');
  window.scrollTo(0, 0);
  // 화면이 바뀌면 스크린리더가 새 내용부터 읽도록 초점을 옮깁니다.
  if (!firstRender) app.focus({ preventScroll: true });
  firstRender = false;
}

function renderMessage(title, detail) {
  setTitle(title);
  render(`
    <h1 class="status-title">${escapeHtml(title)}</h1>
    <p class="status">${detail}</p>
    <a class="back-link" href="#/">← 글 목록으로</a>`);
}

function renderError(error) {
  console.error(error);
  const hint =
    location.protocol === 'file:'
      ? '파일을 직접 열면 글을 불러올 수 없습니다. 로컬 서버(<code>python -m http.server 8000</code>)로 열어 주세요.'
      : '잠시 후 다시 시도해 주세요.';
  renderMessage('글을 불러오지 못했습니다', hint);
}

/* ---------- 화면 ---------- */

async function showList(token, tag) {
  const posts = await loadPosts();
  if (token !== routeToken) return;

  const filtered = tag ? posts.filter((post) => (post.tags || []).includes(tag)) : posts;
  const heading = tag
    ? `<h1 class="page-heading"><strong>#${escapeHtml(tag)}</strong> 태그의 글 ${filtered.length}개</h1>`
    : '<h1 class="page-heading">최근 글</h1>';
  const list = filtered.length
    ? `<ul class="post-list">${filtered.map(postCardHtml).join('')}</ul>`
    : '<p class="status">아직 글이 없습니다.</p>';
  const back = tag ? '<p><a class="back-link" href="#/">← 전체 글 보기</a></p>' : '';

  setTitle(tag ? `#${tag}` : '');
  render(`${heading}${list}${back}`);
}

async function showPost(token, slug) {
  if (!SLUG_RE.test(slug)) {
    renderNotFound();
    return;
  }

  const [text, posts] = await Promise.all([loadPost(slug), loadPosts().catch(() => [])]);
  if (token !== routeToken) return;
  if (text === null) {
    renderNotFound();
    return;
  }

  const { meta, html } = parseMarkdown(text);
  // 주소를 직접 입력해도 draft 글은 열리지 않습니다.
  if (meta.draft === true) {
    renderNotFound();
    return;
  }
  const entry = posts.find((post) => post.slug === slug) || {};
  const title = meta.title || entry.title || slug;
  const date = meta.date || entry.date;
  const tags = Array.isArray(meta.tags) ? meta.tags : entry.tags;

  setTitle(title);
  render(`
    <article class="post">
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(title)}</h1>
        <p class="post-meta">${dateHtml(date)}</p>
        ${tagsHtml(tags)}
      </header>
      <div class="post-body">${html}</div>
      <footer class="post-footer">
        <a class="back-link" href="#/">← 글 목록으로</a>
      </footer>
    </article>`);
}

function renderNotFound() {
  renderMessage('글을 찾을 수 없습니다', '주소가 바뀌었거나 삭제된 글일 수 있습니다.');
}

/* ---------- 라우팅 ---------- */

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return null;
  }
}

async function route() {
  const hash = location.hash;

  // 글 안의 #제목 링크는 화면을 바꾸지 않고 그 위치로 이동만 합니다.
  if (!firstRender && hash && !hash.startsWith('#/')) {
    const target = document.getElementById(decodeSegment(hash.slice(1)) || '');
    if (target && app.contains(target)) return;
  }

  const token = ++routeToken;
  const parts = (hash.startsWith('#/') ? hash.slice(2) : '').split('/');
  app.setAttribute('aria-busy', 'true');

  try {
    if (parts[0] === 'post' && parts[1]) {
      await showPost(token, decodeSegment(parts[1]) || '');
    } else if (parts[0] === 'tag' && parts[1]) {
      const tag = decodeSegment(parts[1]);
      if (tag === null) renderNotFound();
      else await showList(token, tag);
    } else if (parts[0] === '') {
      await showList(token, null);
    } else {
      renderNotFound();
    }
  } catch (error) {
    if (token === routeToken) renderError(error);
  }
}

// 글 본문의 #제목 링크: 해시를 바꾸면 라우팅이 깨지므로 직접 스크롤합니다.
app.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.getAttribute('href').startsWith('#/')) return;
  const id = decodeSegment(link.getAttribute('href').slice(1));
  const target = id && document.getElementById(id);
  if (target && app.contains(target)) {
    event.preventDefault();
    target.scrollIntoView();
  }
});

// "본문으로 건너뛰기"도 해시를 바꾸지 않고 초점만 옮깁니다.
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  app.focus();
});

initThemeToggle(document.querySelector('.theme-toggle'));
window.addEventListener('hashchange', route);
route();
