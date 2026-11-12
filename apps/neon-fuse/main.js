// 네온 퓨즈 화면 — 렌더링, 입력 처리, 저장, 알림
import {
  SIZE,
  move,
  addRandomTile,
  canMove,
  newGame,
  emptyCells,
  levelOf,
  maxLevel,
} from './logic.js';

const BEST_KEY = 'neon-fuse:best';
const TOAST_LEVEL = 7; // 이 단계 이상에 처음 도달하면 토스트로 알림
const SWIPE_MIN = 30; // 스와이프로 인정하는 최소 거리(px)
const SWIPE_RATIO = 1.2; // 주 축 거리가 다른 축 거리의 몇 배를 넘어야 하는지

const KEY_DIRS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const els = {};

const state = {
  board: null,
  score: 0,
  best: 0,
  over: false,
  reachedLevel: 0, // 이번 판에서 도달한 가장 높은 단계
};

let announceTimer = 0;
let toastTimer = 0;

// 최고 점수를 읽습니다. 저장소를 쓸 수 없으면 0으로 시작합니다.
function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    // 숫자만으로 된 문자열이고 안전한 정수 범위일 때만 믿습니다(손상된 값은 0)
    if (typeof raw !== 'string' || !/^\d{1,15}$/.test(raw)) {
      return 0;
    }
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch (err) {
    return 0;
  }
}

// 최고 점수를 저장합니다. 실패하면 조용히 건너뜁니다.
function saveBest(n) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch (err) {
    // 저장소 차단(시크릿 모드 등) — 무시
  }
}

// 단계 값을 CSS용 문자열로 바꿉니다(12 이상은 "hot").
function levelAttr(value) {
  const lv = levelOf(value);
  return lv >= 12 ? 'hot' : String(lv);
}

// 보드를 그립니다. merged/added는 "r,c" 문자열 집합입니다.
function render(current, merged = new Set(), added = new Set()) {
  const fragment = document.createDocumentFragment();
  for (let r = 0; r < SIZE; r += 1) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.setAttribute('role', 'row');
    for (let c = 0; c < SIZE; c += 1) {
      const value = current.board[r][c];
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      const pos = `${r + 1}행 ${c + 1}열`;
      if (value === 0) {
        cell.classList.add('is-empty');
        cell.setAttribute('aria-label', `${pos}, 빈 칸`);
      } else {
        const lv = levelAttr(value);
        const digits = String(value).length;
        cell.dataset.level = lv;
        cell.setAttribute('aria-label', `${pos}, 값 ${value}`);
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.dataset.level = lv;
        chip.dataset.digits = String(Math.min(digits, 5));
        chip.setAttribute('aria-hidden', 'true');
        const key = `${r},${c}`;
        if (merged.has(key)) chip.classList.add('is-merged');
        if (added.has(key)) chip.classList.add('is-new');
        const num = document.createElement('span');
        num.className = 'chip-num';
        num.textContent = String(value);
        chip.appendChild(num);
        cell.appendChild(chip);
      }
      row.appendChild(cell);
    }
    fragment.appendChild(row);
  }
  els.board.replaceChildren(fragment);
  els.score.textContent = String(current.score);
  els.best.textContent = String(current.best);
}

// 화면 읽기 프로그램에 한 번 알립니다(같은 문구도 다시 읽히도록 비웠다가 채움).
function announce(msg) {
  window.clearTimeout(announceTimer);
  els.live.textContent = '';
  announceTimer = window.setTimeout(() => {
    els.live.textContent = msg;
  }, 50);
}

// 짧은 토스트를 보여 줍니다(낭독은 announce가 담당).
function showToast(msg) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = msg;
  els.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove('is-visible');
  }, 2200);
}

function hideToast() {
  window.clearTimeout(toastTimer);
  els.toast.classList.remove('is-visible');
  els.toast.textContent = '';
}

function showGameOver() {
  state.over = true;
  els.finalScore.textContent = String(state.score);
  els.overlay.hidden = false;
  els.alert.textContent = `게임 오버. 최종 점수 ${state.score}점`;
  els.retry.focus();
}

function hideGameOver() {
  state.over = false;
  els.overlay.hidden = true;
  els.alert.textContent = '';
}

// 새 판을 시작합니다.
function startGame(focusBoard = false) {
  hideGameOver();
  hideToast();
  state.board = newGame();
  state.score = 0;
  state.reachedLevel = maxLevel(state.board);
  const added = new Set();
  state.board.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v !== 0) added.add(`${r},${c}`);
    });
  });
  render(state, new Set(), added);
  announce('새 게임 시작. 점수 0');
  if (focusBoard) els.board.focus();
}

// 한 방향으로 밉니다. 상태는 동기적으로 갱신하므로 연속 입력도 바로 처리됩니다.
function handleDirection(dir) {
  if (state.over) return;
  const result = move(state.board, dir);
  if (!result.moved) return; // 변화가 없으면 새 타일도 없음

  const before = new Set(emptyCells(result.board).map(([r, c]) => `${r},${c}`));
  const next = addRandomTile(result.board);
  const added = new Set();
  emptyCells(next).forEach(([r, c]) => before.delete(`${r},${c}`));
  before.forEach((key) => added.add(key));

  state.board = next;
  state.score += result.gained;
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }

  const merged = new Set(result.mergedCells.map(([r, c]) => `${r},${c}`));
  render(state, merged, added);

  let msg = result.gained > 0
    ? `점수 ${state.score}, ${result.gained}점 획득`
    : `점수 ${state.score}`;

  const lv = maxLevel(state.board);
  if (lv > state.reachedLevel) {
    state.reachedLevel = lv;
    if (lv >= TOAST_LEVEL) {
      const levelMsg = `새 빛 단계 도달: Lv ${lv}`;
      showToast(levelMsg);
      msg = `${msg}. ${levelMsg}`;
    }
  }
  announce(msg);

  if (!canMove(state.board)) showGameOver();
}

// 키보드 입력: 방향키와 WASD(대소문자 무관)
function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const dir = KEY_DIRS[key];
    if (!dir) return; // Enter/Space 등은 기본 동작 유지
    event.preventDefault(); // 페이지 스크롤 방지
    if (state.over) return; // 오버레이가 열려 있으면 이동 무시
    handleDirection(dir);
  });
}

// 스와이프 입력: Pointer Events(터치·펜·마우스)
function bindSwipe(el) {
  let start = null;

  el.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      el.setPointerCapture(event.pointerId);
    } catch (err) {
      // 캡처를 지원하지 않아도 동작에는 지장 없음
    }
  });

  el.addEventListener('pointerup', (event) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax >= SWIPE_MIN && ax > ay * SWIPE_RATIO) {
      handleDirection(dx > 0 ? 'right' : 'left');
    } else if (ay >= SWIPE_MIN && ay > ax * SWIPE_RATIO) {
      handleDirection(dy > 0 ? 'down' : 'up');
    }
  });

  el.addEventListener('pointercancel', () => {
    start = null;
  });
}

function init() {
  els.board = document.getElementById('board');
  els.score = document.getElementById('score');
  els.best = document.getElementById('best');
  els.overlay = document.getElementById('overlay');
  els.finalScore = document.getElementById('final-score');
  els.retry = document.getElementById('retry');
  els.newGame = document.getElementById('new-game');
  els.toast = document.getElementById('toast');
  els.live = document.getElementById('live');
  els.alert = document.getElementById('alert');

  state.best = loadBest();

  els.newGame.addEventListener('click', () => startGame(false));
  els.retry.addEventListener('click', () => startGame(true));
  bindKeyboard();
  bindSwipe(els.board);

  startGame(false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
