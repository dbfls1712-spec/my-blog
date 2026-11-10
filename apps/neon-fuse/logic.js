// 네온 퓨즈 게임 로직 — DOM을 쓰지 않는 순수 함수 모음
// 모든 함수는 입력 배열을 변경하지 않고 새 값을 반환합니다.

export const SIZE = 4;

// 4×4 크기의 빈 보드(0으로 채움)를 만듭니다.
export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

// 보드를 깊은 복사합니다.
function cloneBoard(board) {
  return board.map((row) => row.slice());
}

// 한 줄을 앞쪽(인덱스 0 방향)으로 밀고 같은 값을 합칩니다.
// 반환: { line, gained, merged } — merged[i]는 결과 i번째 칸이 이번에 합쳐졌는지 여부
export function slideLine(line) {
  const values = line.filter((v) => v !== 0);
  const result = [];
  const merged = [];
  let gained = 0;
  let i = 0;
  while (i < values.length) {
    if (i + 1 < values.length && values[i] === values[i + 1]) {
      const sum = values[i] * 2;
      result.push(sum);
      merged.push(true);
      gained += sum;
      i += 2;
    } else {
      result.push(values[i]);
      merged.push(false);
      i += 1;
    }
  }
  while (result.length < line.length) {
    result.push(0);
    merged.push(false);
  }
  return { line: result, gained, merged };
}

// 방향에 맞춰 보드의 r행 c열에 해당하는 "줄 위치"를 계산합니다.
// lineIndex: 몇 번째 줄인지, pos: 이동 방향 앞쪽부터 몇 번째 칸인지
function cellAt(dir, lineIndex, pos) {
  const last = SIZE - 1;
  if (dir === 'left') return [lineIndex, pos];
  if (dir === 'right') return [lineIndex, last - pos];
  if (dir === 'up') return [pos, lineIndex];
  return [last - pos, lineIndex]; // down
}

// 보드를 dir 방향으로 밉니다.
// 반환: { board, gained, moved, mergedCells: [[r, c], ...] }
export function move(board, dir) {
  if (!['up', 'down', 'left', 'right'].includes(dir)) {
    throw new Error(`알 수 없는 방향: ${dir}`);
  }
  const next = createEmptyBoard();
  const mergedCells = [];
  let gained = 0;
  let moved = false;

  for (let lineIndex = 0; lineIndex < SIZE; lineIndex += 1) {
    const line = [];
    for (let pos = 0; pos < SIZE; pos += 1) {
      const [r, c] = cellAt(dir, lineIndex, pos);
      line.push(board[r][c]);
    }
    const slid = slideLine(line);
    gained += slid.gained;
    for (let pos = 0; pos < SIZE; pos += 1) {
      const [r, c] = cellAt(dir, lineIndex, pos);
      next[r][c] = slid.line[pos];
      if (slid.line[pos] !== line[pos]) moved = true;
      if (slid.merged[pos]) mergedCells.push([r, c]);
    }
  }

  return { board: next, gained, moved, mergedCells };
}

// 빈 칸 좌표 목록을 반환합니다.
export function emptyCells(board) {
  const cells = [];
  board.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === 0) cells.push([r, c]);
    });
  });
  return cells;
}

// 무작위 빈 칸에 2(90%) 또는 4(10%) 타일을 놓은 새 보드를 반환합니다.
// 빈 칸이 없으면 복사본을 그대로 반환합니다.
export function addRandomTile(board, rng = Math.random) {
  const next = cloneBoard(board);
  const cells = emptyCells(board);
  if (cells.length === 0) return next;
  const index = Math.min(cells.length - 1, Math.floor(rng() * cells.length));
  const [r, c] = cells[index];
  next[r][c] = rng() < 0.9 ? 2 : 4;
  return next;
}

// 움직일 수 있는지(빈 칸 또는 가로·세로로 이웃한 같은 값이 있는지) 확인합니다.
export function canMove(board) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const v = board[r][c];
      if (v === 0) return true;
      if (c + 1 < SIZE && board[r][c + 1] === v) return true;
      if (r + 1 < SIZE && board[r + 1][c] === v) return true;
    }
  }
  return false;
}

// 타일 2개가 놓인 새 게임 보드를 반환합니다.
export function newGame(rng = Math.random) {
  return addRandomTile(addRandomTile(createEmptyBoard(), rng), rng);
}

// 값의 단계(Lv = log2(값))를 반환합니다. 빈 칸은 0.
export function levelOf(value) {
  return value > 0 ? Math.round(Math.log2(value)) : 0;
}

// 보드에서 가장 높은 단계를 반환합니다.
export function maxLevel(board) {
  let max = 0;
  board.forEach((row) => {
    row.forEach((v) => {
      max = Math.max(max, levelOf(v));
    });
  });
  return max;
}
