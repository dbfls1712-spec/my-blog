// 도트 네온 — 화면 그리기, 포인터·키보드 입력, 저장, PNG 내보내기
import {
  SIZE,
  PALETTE,
  createBlank,
  indexOf,
  rowCol,
  setPixel,
  paintCells,
  floodFill,
  lineCells,
  createHistory,
  commit,
  undo,
  redo,
  canUndo,
  canRedo,
  isHex,
  toRGBA,
  isEmpty,
  serialize,
  deserialize
} from './logic.js';

const STORAGE_KEY = 'dot-neon:v1';
const SAVE_DELAY = 300;
const DEFAULT_COLOR = '#00f0ff';
const DEFAULT_CUSTOM = '#ff9ecf';
const DEFAULT_SCALE = 32;

const TOOL_NAMES = {
  pen: '펜',
  eraser: '지우개',
  fill: '채우기',
  picker: '스포이트'
};

const TOOL_KEYS = { p: 'pen', e: 'eraser', f: 'fill', i: 'picker' };

const ARROWS = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};

// 앱 상태
const state = {
  pixels: createBlank(),
  history: null,
  tool: 'pen',
  color: DEFAULT_COLOR,
  custom: DEFAULT_CUSTOM,
  scale: DEFAULT_SCALE,
  cursor: 0
};

// 진행 중인 획: { source: 'pointer' | 'key', start, last, pointerId }
let stroke = null;
// 마지막으로 화면에 그린 그림(바뀐 칸만 갱신하기 위해)
let renderedPixels = null;
let saveTimer = null;

const els = {};
const cellEls = [];
const swatchEls = [];

// ---------- 색 이름 ----------
function colorName(hex) {
  const found = PALETTE.find((entry) => entry.hex === hex);
  return found ? found.name : `사용자 색 ${hex}`;
}

function cellLabel(index, color) {
  const { row, col } = rowCol(index);
  const name = color === null ? '빈 칸' : colorName(color);
  return `${row + 1}행 ${col + 1}열, ${name}`;
}

// ---------- 알림 ----------
function announce(msg) {
  els.status.textContent = '';
  // 같은 문구가 이어져도 다시 읽히도록 한 프레임 뒤에 넣습니다
  requestAnimationFrame(() => {
    els.status.textContent = msg;
  });
}

// ---------- 화면 만들기 ----------
function buildGrid() {
  const fragment = document.createDocumentFragment();
  for (let r = 0; r < SIZE; r += 1) {
    const row = document.createElement('div');
    row.className = 'grid-row';
    row.setAttribute('role', 'row');
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.id = `px-${r}-${c}`;
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('animationend', () => cell.classList.remove('lit'));
      cellEls.push(cell);
      row.appendChild(cell);
    }
    fragment.appendChild(row);
  }
  els.grid.appendChild(fragment);
}

function buildPalette() {
  const fragment = document.createDocumentFragment();
  for (const entry of PALETTE) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.hex = entry.hex;
    btn.style.setProperty('--px', entry.hex);
    btn.setAttribute('aria-label', entry.name);
    btn.setAttribute('aria-pressed', 'false');
    const check = document.createElement('span');
    check.className = 'swatch-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';
    btn.appendChild(check);
    btn.addEventListener('click', () => {
      setColor(entry.hex, entry.name);
      announce(`색: ${entry.name}`);
      scheduleSave();
    });
    swatchEls.push(btn);
    fragment.appendChild(btn);
  }
  // 사용자 색 칸 앞에 16색을 넣습니다
  els.palette.insertBefore(fragment, els.customSwatch);
}

// ---------- 화면 갱신 ----------
// 바뀐 칸만 갱신합니다. lit가 참이면 바뀐 칸에 점등 연출.
function render(lit) {
  const pixels = state.pixels;
  for (let i = 0; i < cellEls.length; i += 1) {
    const color = pixels[i];
    if (renderedPixels && renderedPixels[i] === color) {
      continue;
    }
    const cell = cellEls[i];
    if (color === null) {
      cell.classList.remove('filled');
      cell.style.removeProperty('--px');
    } else {
      cell.classList.add('filled');
      cell.style.setProperty('--px', color);
    }
    cell.setAttribute('aria-label', cellLabel(i, color));
    if (lit && renderedPixels) {
      cell.classList.remove('lit');
      // 애니메이션을 다시 시작하기 위해 스타일을 한 번 읽습니다
      void cell.offsetWidth;
      cell.classList.add('lit');
    }
  }
  renderedPixels = pixels;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  els.undoBtn.disabled = !canUndo(state.history);
  els.redoBtn.disabled = !canRedo(state.history);
}

function updateCursor(index) {
  const prev = cellEls[state.cursor];
  if (prev) {
    prev.classList.remove('is-cursor');
  }
  state.cursor = index;
  const cell = cellEls[index];
  cell.classList.add('is-cursor');
  els.grid.setAttribute('aria-activedescendant', cell.id);
}

function updateCurrent() {
  els.currentSwatch.style.setProperty('--px', state.color);
  els.currentText.textContent = `${colorName(state.color)} · ${TOOL_NAMES[state.tool]}`;
}

function setTool(tool) {
  endStroke();
  state.tool = tool;
  for (const btn of els.toolBtns) {
    btn.setAttribute('aria-pressed', String(btn.dataset.tool === tool));
  }
  updateCurrent();
}

function setColor(hex) {
  state.color = hex;
  let matched = false;
  for (const btn of swatchEls) {
    const on = btn.dataset.hex === hex;
    btn.setAttribute('aria-pressed', String(on));
    matched = matched || on;
  }
  // 팔레트에 없는 색은 사용자 색으로 표시
  if (!matched && hex !== state.custom) {
    state.custom = hex;
    els.customColor.value = hex;
  }
  els.customSwatch.classList.toggle('is-selected', !matched);
  updateCurrent();
}

// ---------- 획(펜·지우개) ----------
function strokeColor() {
  return state.tool === 'eraser' ? null : state.color;
}

function beginStroke(source, pointerId) {
  endStroke();
  stroke = { source, start: state.pixels, last: null, pointerId };
}

function extendStroke(index) {
  if (!stroke) {
    return;
  }
  const indices = stroke.last === null ? [index] : lineCells(stroke.last, index);
  stroke.last = index;
  const next = paintCells(state.pixels, indices, strokeColor());
  if (next !== state.pixels) {
    state.pixels = next;
    render(true);
  }
}

function endStroke() {
  if (!stroke) {
    return;
  }
  const { start } = stroke;
  stroke = null;
  // 그림이 바뀐 획만 기록 1개로 남깁니다
  if (state.pixels !== start) {
    state.history = commit(state.history, state.pixels);
    updateHistoryButtons();
    scheduleSave();
  }
}

// ---------- 도구 적용 ----------
// 한 칸에 현재 도구를 한 번 적용합니다(클릭·Space/Enter·채우기·스포이트).
function applyAt(index) {
  const tool = state.tool;
  if (tool === 'pen' || tool === 'eraser') {
    const next = setPixel(state.pixels, index, strokeColor());
    if (next !== state.pixels) {
      state.pixels = next;
      state.history = commit(state.history, next);
      render(true);
      scheduleSave();
    }
    return;
  }
  if (tool === 'fill') {
    const result = floodFill(state.pixels, index, state.color);
    if (result.count === 0) {
      announce('이미 같은 색이에요');
      return;
    }
    state.pixels = result.pixels;
    state.history = commit(state.history, result.pixels);
    render(true);
    announce(`채우기: ${result.count}칸`);
    scheduleSave();
    return;
  }
  if (tool === 'picker') {
    const picked = state.pixels[index];
    if (picked === null) {
      announce('빈 칸이에요');
      return;
    }
    setColor(picked);
    setTool('pen');
    announce(`색: ${colorName(picked)} · 펜 선택`);
    scheduleSave();
  }
}

// ---------- 되돌리기 ----------
function doUndo() {
  endStroke();
  if (!canUndo(state.history)) {
    announce('더 되돌릴 수 없어요');
    return;
  }
  state.history = undo(state.history);
  state.pixels = state.history.present;
  render(false);
  announce('되돌렸어요');
  scheduleSave();
}

function doRedo() {
  endStroke();
  if (!canRedo(state.history)) {
    announce('더 다시 할 수 없어요');
    return;
  }
  state.history = redo(state.history);
  state.pixels = state.history.present;
  render(false);
  announce('다시 했어요');
  scheduleSave();
}

function clearAll() {
  endStroke();
  if (isEmpty(state.pixels)) {
    announce('이미 빈 그림이에요');
    return;
  }
  state.pixels = createBlank();
  state.history = commit(state.history, state.pixels);
  render(false);
  announce('전체 지웠어요. 되돌리기로 복구할 수 있어요');
  scheduleSave();
}

// ---------- 포인터 입력 ----------
// 화면 좌표 → 칸 번호. 격자 밖이면 -1.
function cellFromPoint(x, y) {
  const rect = els.grid.getBoundingClientRect();
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    return -1;
  }
  const col = Math.min(SIZE - 1, Math.floor(((x - rect.left) / rect.width) * SIZE));
  const row = Math.min(SIZE - 1, Math.floor(((y - rect.top) / rect.height) * SIZE));
  return indexOf(row, col);
}

function bindPointer(gridEl) {
  gridEl.addEventListener('pointerdown', (event) => {
    // 마우스는 주 버튼만, 터치·펜은 그대로
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (stroke && stroke.source === 'pointer') {
      return;
    }
    const index = cellFromPoint(event.clientX, event.clientY);
    if (index < 0) {
      return;
    }
    event.preventDefault();
    gridEl.focus({ preventScroll: true });
    gridEl.classList.remove('show-cursor');
    updateCursor(index);

    if (state.tool === 'pen' || state.tool === 'eraser') {
      beginStroke('pointer', event.pointerId);
      try {
        gridEl.setPointerCapture(event.pointerId);
      } catch (error) {
        // 캡처를 못 해도 그리기는 계속합니다
      }
      extendStroke(index);
    } else {
      // 채우기·스포이트는 누를 때 한 번만
      applyAt(index);
    }
  });

  gridEl.addEventListener('pointermove', (event) => {
    if (!stroke || stroke.source !== 'pointer' || stroke.pointerId !== event.pointerId) {
      return;
    }
    const index = cellFromPoint(event.clientX, event.clientY);
    if (index < 0) {
      // 격자 밖으로 나가면 다시 들어올 때 새로 이어 그립니다
      stroke.last = null;
      return;
    }
    if (index !== stroke.last) {
      updateCursor(index);
      extendStroke(index);
    }
  });

  const finish = (event) => {
    if (stroke && stroke.source === 'pointer' && stroke.pointerId === event.pointerId) {
      endStroke();
    }
  };
  gridEl.addEventListener('pointerup', finish);
  gridEl.addEventListener('pointercancel', finish);
  gridEl.addEventListener('lostpointercapture', finish);
  gridEl.addEventListener('contextmenu', (event) => event.preventDefault());
}

// ---------- 키보드 입력 ----------
function isTypingTarget(target) {
  if (!target || !target.tagName) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea';
}

function bindKeyboard(gridEl) {
  gridEl.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const { row, col } = rowCol(state.cursor);
    let target = -1;
    if (ARROWS[event.key]) {
      const [dr, dc] = ARROWS[event.key];
      const nr = Math.max(0, Math.min(SIZE - 1, row + dr));
      const nc = Math.max(0, Math.min(SIZE - 1, col + dc));
      target = indexOf(nr, nc);
    } else if (event.key === 'Home') {
      target = indexOf(row, 0);
    } else if (event.key === 'End') {
      target = indexOf(row, SIZE - 1);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      gridEl.classList.add('show-cursor');
      if (!event.repeat) {
        applyAt(state.cursor);
      }
      return;
    } else {
      return;
    }

    event.preventDefault();
    gridEl.classList.add('show-cursor');
    const paintTool = state.tool === 'pen' || state.tool === 'eraser';
    if (event.shiftKey && paintTool) {
      // Shift를 누른 동안 이어진 이동은 하나의 획
      if (!stroke || stroke.source !== 'key') {
        beginStroke('key');
        extendStroke(state.cursor);
      }
      updateCursor(target);
      extendStroke(target);
    } else {
      if (stroke && stroke.source === 'key') {
        endStroke();
      }
      updateCursor(target);
    }
  });

  gridEl.addEventListener('keyup', (event) => {
    if (event.key === 'Shift' && stroke && stroke.source === 'key') {
      endStroke();
    }
  });

  gridEl.addEventListener('blur', () => {
    if (stroke && stroke.source === 'key') {
      endStroke();
    }
  });

  // 도구·되돌리기 단축키(입력란에 포커스가 있으면 무시)
  document.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      if (event.altKey) {
        return;
      }
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        doUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        doRedo();
      }
      return;
    }
    if (event.altKey || event.shiftKey || event.repeat) {
      return;
    }
    const tool = TOOL_KEYS[key];
    if (tool) {
      event.preventDefault();
      setTool(tool);
      announce(`${TOOL_NAMES[tool]} 선택`);
      scheduleSave();
    }
  });
}

// ---------- PNG 내보내기 ----------
function pad(n) {
  return String(n).padStart(2, '0');
}

function fileName() {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `dot-neon-${date}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
}

function exportPng(scale) {
  const width = SIZE * scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    announce('저장에 실패했어요');
    return;
  }
  // fillRect 대신 픽셀 배열로 그려 경계가 번지지 않게 합니다
  ctx.putImageData(new ImageData(toRGBA(state.pixels, scale), width, width), 0, 0);
  const empty = isEmpty(state.pixels);
  canvas.toBlob((blob) => {
    if (!blob) {
      announce('저장에 실패했어요');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    // 다운로드가 시작된 뒤 주소를 정리합니다
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const size = `PNG 저장: ${width}×${width}`;
    announce(empty ? `${size}. 빈 그림이라 투명한 이미지예요` : size);
  }, 'image/png');
}

// ---------- 저장(localStorage) ----------
function saveNow() {
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, serialize({
      pixels: state.pixels,
      color: state.color,
      custom: state.custom,
      tool: state.tool,
      scale: state.scale
    }));
  } catch (error) {
    // 저장이 막혀 있어도 조용히 넘어갑니다
  }
}

function scheduleSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(saveNow, SAVE_DELAY);
}

function loadState() {
  let saved = null;
  try {
    saved = deserialize(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    saved = null;
  }
  if (!saved) {
    return;
  }
  state.pixels = saved.pixels;
  state.color = saved.color;
  state.custom = saved.custom;
  state.tool = saved.tool;
  state.scale = saved.scale;
}

// ---------- 시작 ----------
function init() {
  els.grid = document.getElementById('grid');
  els.palette = document.getElementById('palette');
  els.customSwatch = document.getElementById('custom-swatch');
  els.customColor = document.getElementById('custom-color');
  els.currentSwatch = document.getElementById('current-swatch');
  els.currentText = document.getElementById('current-text');
  els.undoBtn = document.getElementById('undo-btn');
  els.redoBtn = document.getElementById('redo-btn');
  els.clearBtn = document.getElementById('clear-btn');
  els.saveBtn = document.getElementById('save-btn');
  els.status = document.getElementById('status');
  els.toolBtns = Array.from(document.querySelectorAll('.tool-btn'));
  els.scaleInputs = Array.from(document.querySelectorAll('input[name="scale"]'));

  loadState();
  state.history = createHistory(state.pixels);

  buildGrid();
  buildPalette();
  els.grid.classList.add('show-cursor');

  els.customColor.value = state.custom;
  setColor(state.color);
  setTool(state.tool);
  for (const input of els.scaleInputs) {
    input.checked = Number(input.value) === state.scale;
  }
  updateCursor(0);
  render(false);

  for (const btn of els.toolBtns) {
    btn.addEventListener('click', () => {
      setTool(btn.dataset.tool);
      announce(`${TOOL_NAMES[btn.dataset.tool]} 선택`);
      scheduleSave();
    });
  }

  // 사용자 색: 값을 바꾸면 즉시 현재 색, 알림은 확정(change) 때 한 번
  els.customColor.addEventListener('input', () => {
    const value = els.customColor.value.toLowerCase();
    if (!isHex(value)) {
      return;
    }
    state.custom = value;
    setColor(value);
  });
  els.customColor.addEventListener('change', () => {
    const value = els.customColor.value.toLowerCase();
    if (!isHex(value)) {
      return;
    }
    state.custom = value;
    setColor(value);
    announce(`색: 사용자 색 ${value}`);
    scheduleSave();
  });
  // 이미 고른 사용자 색을 다시 누르면(값 변화 없음) 그 색을 현재 색으로
  els.customColor.addEventListener('click', () => {
    if (state.color !== state.custom) {
      setColor(state.custom);
      announce(`색: 사용자 색 ${state.custom}`);
      scheduleSave();
    }
  });

  els.undoBtn.addEventListener('click', doUndo);
  els.redoBtn.addEventListener('click', doRedo);
  els.clearBtn.addEventListener('click', clearAll);
  els.saveBtn.addEventListener('click', () => exportPng(state.scale));

  for (const input of els.scaleInputs) {
    input.addEventListener('change', () => {
      if (input.checked) {
        state.scale = Number(input.value);
        scheduleSave();
      }
    });
  }

  bindPointer(els.grid);
  bindKeyboard(els.grid);

  // 페이지를 떠나기 전 남은 저장을 마칩니다
  window.addEventListener('pagehide', () => {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveNow();
    }
  });
}

init();
