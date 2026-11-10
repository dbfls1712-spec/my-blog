// 도트 네온 — 그림 데이터 로직 (DOM을 쓰지 않는 순수 함수만 모아 둡니다)
// 모든 함수는 입력 배열을 바꾸지 않고 새 값을 돌려줍니다.

// 격자 한 변의 칸 수
export const SIZE = 16;

// 되돌리기 기록 최대 단계
export const HISTORY_LIMIT = 50;

// 그림 팔레트 16색
export const PALETTE = [
  { name: '먹물', hex: '#12121f' },
  { name: '회로 남색', hex: '#2a2f5a' },
  { name: '안개 회색', hex: '#8b93b8' },
  { name: '백열 흰색', hex: '#f4fffd' },
  { name: '네온 시안', hex: '#00f0ff' },
  { name: '심해 청록', hex: '#007a8a' },
  { name: '전기 파랑', hex: '#3d6bff' },
  { name: '네온 바이올렛', hex: '#b98cff' },
  { name: '보라 그늘', hex: '#5b2a86' },
  { name: '네온 핑크', hex: '#ff2bd6' },
  { name: '장미 빨강', hex: '#ff3d5a' },
  { name: '노을 주황', hex: '#ff7a1a' },
  { name: '앰버', hex: '#ffb347' },
  { name: '레몬 전구', hex: '#fff05a' },
  { name: '네온 라임', hex: '#a6ff4d' },
  { name: '숲 초록', hex: '#1f9e4a' }
];

// 저장값에서 허용하는 도구와 배율
export const TOOLS = ['pen', 'eraser', 'fill', 'picker'];
export const SCALES = [1, 8, 32];

const CELL_COUNT = SIZE * SIZE;

// 모든 칸이 빈 칸(null)인 새 그림
export function createBlank() {
  return new Array(CELL_COUNT).fill(null);
}

// 행·열 → 칸 번호
export function indexOf(row, col) {
  return row * SIZE + col;
}

// 칸 번호 → { row, col }
export function rowCol(index) {
  return { row: Math.floor(index / SIZE), col: index % SIZE };
}

function inRange(index) {
  return Number.isInteger(index) && index >= 0 && index < CELL_COUNT;
}

// 한 칸 칠하기. 값이 같으면 원래 배열을 그대로 돌려줘 "변경 없음"을 알 수 있게 합니다.
export function setPixel(pixels, index, color) {
  if (!inRange(index) || pixels[index] === color) {
    return pixels;
  }
  const next = pixels.slice();
  next[index] = color;
  return next;
}

// 여러 칸을 한 번에 칠하기(획 한 번). 바뀐 칸이 없으면 원래 배열 그대로.
export function paintCells(pixels, indices, color) {
  let next = pixels;
  for (const index of indices) {
    if (!inRange(index) || next[index] === color) {
      continue;
    }
    if (next === pixels) {
      next = pixels.slice();
    }
    next[index] = color;
  }
  return next;
}

// 상하좌우로 이어진 같은 색 영역 채우기(반복문, 재귀 없음)
export function floodFill(pixels, index, color) {
  if (!inRange(index)) {
    return { pixels, count: 0 };
  }
  const target = pixels[index];
  if (target === color) {
    return { pixels, count: 0 };
  }
  const next = pixels.slice();
  const stack = [index];
  next[index] = color;
  let count = 1;
  while (stack.length > 0) {
    const current = stack.pop();
    const { row, col } = rowCol(current);
    const neighbors = [];
    if (row > 0) neighbors.push(current - SIZE);
    if (row < SIZE - 1) neighbors.push(current + SIZE);
    if (col > 0) neighbors.push(current - 1);
    if (col < SIZE - 1) neighbors.push(current + 1);
    for (const n of neighbors) {
      if (next[n] === target) {
        next[n] = color;
        count += 1;
        stack.push(n);
      }
    }
  }
  return { pixels: next, count };
}

// 두 칸 사이를 잇는 칸 번호 목록(브레젠험 직선). 시작·끝 칸 포함.
export function lineCells(from, to) {
  const a = rowCol(from);
  const b = rowCol(to);
  let x = a.col;
  let y = a.row;
  const dx = Math.abs(b.col - a.col);
  const dy = -Math.abs(b.row - a.row);
  const sx = a.col < b.col ? 1 : -1;
  const sy = a.row < b.row ? 1 : -1;
  let err = dx + dy;
  const cells = [];
  for (;;) {
    cells.push(indexOf(y, x));
    if (x === b.col && y === b.row) {
      break;
    }
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

// 되돌리기 기록 만들기
export function createHistory(pixels) {
  return { past: [], present: pixels, future: [] };
}

// 새 그림을 기록에 남기기. 변경이 없으면 기록 그대로, 50개 초과분은 오래된 것부터 버림.
export function commit(history, pixels) {
  if (pixels === history.present) {
    return history;
  }
  const past = history.past.concat([history.present]);
  const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past;
  return { past: trimmed, present: pixels, future: [] };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}

export function undo(history) {
  if (!canUndo(history)) {
    return history;
  }
  const past = history.past.slice(0, -1);
  const previous = history.past[history.past.length - 1];
  return { past, present: previous, future: [history.present].concat(history.future) };
}

export function redo(history) {
  if (!canRedo(history)) {
    return history;
  }
  const [next, ...future] = history.future;
  return { past: history.past.concat([history.present]), present: next, future };
}

// "#rrggbb" 형식인지 확인
export function isHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// PNG용 RGBA 배열. 한 칸을 scale×scale 픽셀로 키우고, 빈 칸은 알파 0(투명).
export function toRGBA(pixels, scale) {
  const width = SIZE * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const color = pixels[i];
    if (color === null) {
      continue;
    }
    const { r, g, b } = hexToRgb(color);
    const { row, col } = rowCol(i);
    for (let y = row * scale; y < (row + 1) * scale; y += 1) {
      for (let x = col * scale; x < (col + 1) * scale; x += 1) {
        const p = (y * width + x) * 4;
        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
    }
  }
  return data;
}

// 모든 칸이 빈 칸인지
export function isEmpty(pixels) {
  return pixels.every((p) => p === null);
}

// 저장할 상태를 JSON 문자열로
export function serialize(state) {
  return JSON.stringify({
    pixels: state.pixels,
    color: state.color,
    custom: state.custom,
    tool: state.tool,
    scale: state.scale
  });
}

// 저장된 문자열을 상태로. 형식이 하나라도 어긋나면 null.
export function deserialize(text) {
  if (typeof text !== 'string') {
    return null;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return null;
  }
  if (!data || typeof data !== 'object') {
    return null;
  }
  const { pixels, color, custom, tool, scale } = data;
  if (!Array.isArray(pixels) || pixels.length !== CELL_COUNT) {
    return null;
  }
  if (!pixels.every((p) => p === null || isHex(p))) {
    return null;
  }
  if (!isHex(color) || !isHex(custom)) {
    return null;
  }
  if (!TOOLS.includes(tool) || !SCALES.includes(scale)) {
    return null;
  }
  return {
    pixels: pixels.map((p) => (p === null ? null : p.toLowerCase())),
    color: color.toLowerCase(),
    custom: custom.toLowerCase(),
    tool,
    scale
  };
}
