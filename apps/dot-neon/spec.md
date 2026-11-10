# 도트 네온 (Dot Neon) — 계획서

## 1. 개요
- 앱 이름: 도트 네온 / Dot Neon
- 폴더: `apps/dot-neon/`
- 한 줄 소개: 16×16 칸에 네온 도트를 찍어 작은 픽셀 그림을 만들고 PNG로 저장하는 에디터.
- 콘셉트: 어두운 "네온사인 작업대". 칸 하나하나가 꺼진 전구이고, 색을 칠하면 그 전구에 불이 들어옵니다. 빈 칸은 어두운 체크무늬(투명)로 보이고, 저장하면 투명 PNG가 됩니다.

## 2. 기능과 도구별 동작
| 도구 | 단축키 | 동작 |
|---|---|---|
| 펜 | P | 누른 칸과 드래그로 지나간 칸을 현재 색으로 칠함 |
| 지우개 | E | 칸을 빈 칸(투명)으로 되돌림, 드래그 가능 |
| 채우기 | F | 누른 칸과 상하좌우로 이어진 같은 색(빈 칸 포함) 영역을 현재 색으로 채움. 같은 색이면 아무것도 안 함 |
| 스포이트 | I | 누른 칸의 색을 현재 색으로 가져오고 펜으로 자동 전환. 빈 칸이면 색을 바꾸지 않고 "빈 칸이에요" 알림 |
| 되돌리기 / 다시 하기 | Ctrl+Z / Ctrl+Y(또는 Ctrl+Shift+Z) | 그림 변경 기록 최대 50단계. 한 번의 드래그(획) = 기록 1개 |
| 전체 지우기 | (버튼만) | 모든 칸을 빈 칸으로. 되돌리기로 복구 가능하므로 확인 창 없이 실행하고 "되돌리기로 복구할 수 있어요" 알림 |
| PNG 저장 | (버튼만) | 선택한 배율로 PNG 다운로드(5장) |

- 넣지 않는 것: 레이어, 선/사각형 도구, 격자 크기 변경, 애니메이션 프레임(작게 유지).
- 그림을 바꾸지 않는 동작(같은 색 위에 펜, 빈 칸에 지우개만 지나감 등)은 기록에 남기지 않음.

## 3. 화면 구성
```
┌──────────────────────────────┐
│ ← 블로그로   (../../index.html, target="_top")
│ DOT NEON  도트 네온 (제목, 빛번짐)
│ 16×16 칸에 네온 도트를 찍어 보세요
│ [펜][지우개][채우기][스포이트]    ← 도구 (aria-pressed)
│ ┏━━━━━━━━━━━━━━━━━━━━━━┓
│ ┃ 16×16 격자 (빈 칸 = 체크무늬)  ┃ ← 키보드 커서는 cyan 이중 테두리
│ ┗━━━━━━━━━━━━━━━━━━━━━━┛
│ 현재: [■] 네온 시안 · 펜          ← 현재 색·도구 표시줄
│ 팔레트 ■■■■■■■■ / ■■■■■■■■ + [사용자 색]
│ [↶ 되돌리기][↷ 다시 하기][전체 지우기]
│ 저장 크기 (16px | 128px | 512px)  [PNG 저장]
│ 도움말: 방향키 이동 · Space 칠하기 · Shift+방향키 이동하며 칠하기
│ [aria-live 상태 문구]
└──────────────────────────────┘
```
- 앱 최대 폭 480px, 좌우 여백 16px. 격자: `width: min(92vw, 420px, calc(100vw - 32px))`, `aspect-ratio: 1`, CSS grid 16열, 칸 사이 1px 선(`--grid-line`). 320px 폭에서 칸 약 18px(그리기 칸은 44px 예외), 375px에서 약 21px.
- 넓은 화면(≥ 720px, iframe 폭 기준)에서는 격자 왼쪽, 도구·팔레트 오른쪽 2단. 좁으면 1단.
- 도구·되돌리기·저장 버튼과 팔레트 칸은 모두 44×44px 이상. 팔레트는 `grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))`로 320px에서도 줄바꿈.
- 빛번짐(text-shadow/box-shadow)은 제목과 "선택된 도구 버튼"에만. 칠한 칸 자체에는 빛번짐 없음(그림 색을 그대로 보이게).
- 칠하는 순간 칸이 0.12초 밝아지는 "점등" 연출. `prefers-reduced-motion: reduce`에서 끔.

### UI 색 (`:root` 변수)
블로그 변수 `--bg #050508`, `--bg-elev #0b0b14`, `--text #d9fff7`, `--muted #8b93b8`, `--neon-cyan #00f0ff`, `--neon-pink #ff2bd6`, `--neon-lime #a6ff4d`에 추가: `--grid-line #1c2038`, `--checker-a #10101c`, `--checker-b #191a2b`, `--btn-line #3a4266`, `--cursor #00f0ff`.
- 글자 조합은 `--text`/`--muted`/`--neon-cyan` on `--bg`·`--bg-elev`(모두 6.5:1 이상), 선택 버튼은 `--bg` 글자 on `--neon-cyan` 배경(약 14:1)만 사용.

### 그림 팔레트 (JS 상수 `PALETTE`, 고유 구성)
| # | 이름 | 값 | # | 이름 | 값 |
|---|---|---|---|---|---|
| 1 | 먹물 | `#12121f` | 9 | 보라 그늘 | `#5b2a86` |
| 2 | 회로 남색 | `#2a2f5a` | 10 | 네온 핑크 | `#ff2bd6` |
| 3 | 안개 회색 | `#8b93b8` | 11 | 장미 빨강 | `#ff3d5a` |
| 4 | 백열 흰색 | `#f4fffd` | 12 | 노을 주황 | `#ff7a1a` |
| 5 | 네온 시안 | `#00f0ff` | 13 | 앰버 | `#ffb347` |
| 6 | 심해 청록 | `#007a8a` | 14 | 레몬 전구 | `#fff05a` |
| 7 | 전기 파랑 | `#3d6bff` | 15 | 네온 라임 | `#a6ff4d` |
| 8 | 네온 바이올렛 | `#b98cff` | 16 | 숲 초록 | `#1f9e4a` |
- 17번째 칸: `<input type="color">`(라벨 "사용자 색", 기본값 `#ff9ecf`). 값을 바꾸면 즉시 현재 색이 됨. 이름은 "사용자 색 #rrggbb"로 알림.
- 투명: 팔레트에 넣지 않고 지우개 도구로만 처리. 데이터에서는 `null`.
- 선택 표시는 색에만 의존하지 않음: 선택된 칸에 3px `--text` 테두리 + 안쪽 체크 표시(✓), `aria-pressed="true"`.

## 4. 조작과 접근성
### 포인터 (마우스·터치·펜 공통, Pointer Events)
- 격자에 `pointerdown` → `setPointerCapture` → `pointermove` → `pointerup`/`pointercancel`로 획 종료.
- 칸 계산은 `getBoundingClientRect` 좌표로(캡처 중엔 target이 고정되므로). 빠른 드래그로 칸이 건너뛰지 않게 이전 칸~현재 칸을 `lineCells`(브레젠험)로 이어 칠함.
- 채우기·스포이트는 `pointerdown` 한 번에만 동작(드래그 무시).
- 스크롤 방지: 격자에 `touch-action: none`, body에 `overscroll-behavior: none`. 격자 밖(팔레트 등)은 평소처럼 스크롤 가능.
- 주 버튼만 그리기(`event.button === 0` 또는 터치/펜). 오른쪽 클릭 메뉴는 격자에서 `contextmenu` 막음.

### 키보드
- 격자는 `tabindex="0"` 하나의 포커스 대상, 커서 위치는 `aria-activedescendant`로 칸 id(`px-r-c`) 지정.
- 방향키: 커서 이동(가장자리에서 멈춤). Home/End: 행의 처음/끝. 키 입력 시 `preventDefault`로 페이지 스크롤 방지.
- Space/Enter: 현재 도구를 커서 칸에 적용(기록 1개).
- Shift+방향키: 이동하면서 펜/지우개 적용(Shift를 누른 동안 이어진 이동은 하나의 획 = 기록 1개, Shift를 떼면 획 종료).
- 도구 단축키 P/E/F/I, 되돌리기 Ctrl/⌘+Z, 다시 하기 Ctrl/⌘+Y·Ctrl/⌘+Shift+Z. `input`/`select`에 포커스가 있을 때는 단축키 무시.
- 포인터로 칸을 누르면 키보드 커서도 그 칸으로 이동.

### 화면 읽기 프로그램
- 격자: `role="grid"`, `aria-label="16×16 그림판"`, `aria-describedby`로 도움말 연결. 16개 `role="row"` 안에 `role="gridcell"` 256개. 칸 `aria-label="3행 5열, 네온 시안"` / `"3행 5열, 빈 칸"`.
- 도구 버튼: `aria-pressed`, 그룹은 `role="group" aria-label="그리기 도구"`. 팔레트 그룹 `aria-label="색 팔레트"`, 각 칸 `aria-label="네온 시안"`.
- `aria-live="polite"` 상태 문구 하나로 알림(짧게, 동작당 1회): "펜 선택", "색: 앰버", "채우기: 12칸", "되돌렸어요", "더 되돌릴 수 없어요", "전체 지웠어요. 되돌리기로 복구할 수 있어요", "PNG 저장: 512×512". 커서 이동은 `aria-activedescendant`로 칸 이름이 읽히므로 따로 알리지 않음.
- 되돌리기/다시 하기 버튼은 불가능할 때 `disabled`.
- `:focus-visible`: 2px `--neon-cyan` 외곽선 + 2px 간격. 격자 포커스 시 커서 칸에 cyan 이중 테두리(포커스 없을 땐 숨김).

## 5. PNG 저장
- 배율 선택: 라디오 3개 "16px(원본)", "128px(×8)", "512px(×32)". 기본 512px, 선택값도 저장.
- 순서: `toRGBA(pixels, scale)`로 RGBA 배열 생성 → 화면에 붙이지 않은 `<canvas>`(크기 16×scale)에 `putImageData` → `canvas.toBlob(cb, 'image/png')` → `URL.createObjectURL` → 임시 `<a download>` 클릭 → `revokeObjectURL`.
- `fillRect` 대신 픽셀 배열로 그려 안티에일리어싱·번짐이 없게. 빈 칸은 알파 0(투명).
- 파일 이름: `dot-neon-YYYYMMDD-HHMM.png`.
- 그림이 전부 빈 칸이면 저장은 하되 "빈 그림이라 투명한 이미지예요" 알림. `toBlob`이 null이면 "저장에 실패했어요" 알림.

## 6. 파일 구조와 주요 함수
```
apps/dot-neon/
├── spec.md     이 계획서
├── index.html  마크업, Gaegu 글꼴, <script type="module" src="main.js">
├── style.css   :root 변수, 레이아웃, 격자·체크무늬, 도구·팔레트, 반응형, reduced-motion
├── logic.js    DOM 없는 순수 함수(export). 입력 배열을 바꾸지 않고 새 값을 반환
└── main.js     렌더링, 포인터·키보드 입력, 저장, PNG 내보내기, 알림
```
- 블로그 `css/`, `js/`는 import하지 않음. 외부 라이브러리 없음(Gaegu만).

### logic.js
- 상수 `SIZE = 16`, `PALETTE = [{ name, hex }, ...]`, `HISTORY_LIMIT = 50`
- `createBlank()` → 길이 256, 모두 `null`
- `indexOf(row, col)` / `rowCol(index)`
- `setPixel(pixels, index, color)` → 새 배열(값이 같으면 원래 배열 그대로 반환해 "변경 없음" 판단)
- `paintCells(pixels, indices, color)` → 새 배열(획 한 번에 여러 칸)
- `floodFill(pixels, index, color)` → `{ pixels, count }` 4방향, 반복문(재귀 없음)
- `lineCells(from, to)` → 두 칸 사이 칸 index 목록(브레젠험)
- `createHistory(pixels)` → `{ past: [], present, future: [] }`
- `commit(history, pixels)` → 새 기록(변경 없으면 그대로, 50개 초과분 버림, future 비움)
- `undo(history)` / `redo(history)` / `canUndo` / `canRedo`
- `hexToRgb(hex)` → `{ r, g, b }`; `isHex(value)`
- `toRGBA(pixels, scale)` → `Uint8ClampedArray`(길이 (16·scale)²·4)
- `isEmpty(pixels)`
- `serialize(state)` / `deserialize(text)` → 잘못된 값이면 `null`(길이·hex 형식 검사)

### main.js
- `init()`, `buildGrid()`, `render()`(바뀐 칸만 갱신), `setTool(tool)`, `setColor(hex, name)`
- `bindPointer(gridEl)`, `bindKeyboard(gridEl)`, `beginStroke()`, `extendStroke(index)`, `endStroke()`
- `applyAt(index)`(채우기·스포이트 포함), `doUndo()`, `doRedo()`, `clearAll()`
- `exportPng(scale)`, `announce(msg)`, `loadState()`, `scheduleSave()`(획 종료 후 300ms 지연 저장)

## 7. 저장 (localStorage)
- 키: `dot-neon:v1`
- 값(JSON): `{ "pixels": [null | "#rrggbb", ...256], "color": "#00f0ff", "custom": "#ff9ecf", "tool": "pen", "scale": 32 }`
- 획 종료·도구/색/배율 변경·되돌리기·전체 지우기 후 저장. 되돌리기 기록은 저장하지 않음(새로고침 시 기록 비움).
- 읽기·쓰기 모두 try/catch. 실패하거나 `deserialize`가 `null`이면 빈 그림·기본값으로 시작하고 조용히 넘어감.

## 8. 블로그 메인 카드 문구
- 제목: 도트 네온
- 설명: 16×16 칸에 네온 도트를 찍어 작은 픽셀 그림을 만들어 보세요. 펜·채우기·스포이트로 그리고 투명 PNG로 저장할 수 있어요.
- 미리보기: `apps/dot-neon/index.html`을 iframe(높이 약 820px, `loading="lazy"`, `title="도트 네온 픽셀 그림판"`)으로.

## 9. 완료 확인 체크리스트 (Review용)
- [ ] 펜·지우개 클릭/드래그 동작, 빠르게 드래그해도 칸이 끊기지 않는다(lineCells)
- [ ] 채우기가 4방향 같은 색 영역만 채우고(대각선 제외), 빈 칸 영역도 채운다. 같은 색이면 기록이 안 생긴다
- [ ] 스포이트가 색을 가져오고 펜으로 바뀐다. 빈 칸에서는 색이 안 바뀐다
- [ ] 드래그 한 번 = 되돌리기 1단계, 50단계 제한, 새로 그리면 다시 하기 기록이 비워진다
- [ ] 전체 지우기 후 되돌리기로 복구된다
- [ ] 팔레트 16색 + 사용자 색 선택, 선택 표시가 색 이외(테두리·✓·aria-pressed)로도 보인다
- [ ] PNG 3가지 배율 크기가 정확(16/128/512px), 빈 칸은 투명, 경계가 번지지 않는다
- [ ] 새로고침 후 그림·색·도구·배율이 유지된다. localStorage 차단·잘못된 저장값에서도 오류 없이 빈 그림으로 시작한다
- [ ] 모바일(375px) 터치로 그릴 때 페이지가 스크롤·새로고침되지 않는다. 마우스·펜에서도 동작
- [ ] 키보드만으로: Tab으로 격자 진입, 방향키·Home/End 이동, Space/Enter 칠하기, Shift+방향키 연속 칠하기, P/E/F/I, Ctrl+Z/Y
- [ ] 방향키 입력 시 페이지가 스크롤되지 않고, 색 입력란 포커스 중엔 단축키가 동작하지 않는다
- [ ] 격자 role/label, 칸 aria-label(행·열·색), aria-live 알림(도구·색·되돌리기·저장)이 있다
- [ ] 375px·320px에서 가로 스크롤 없음, iframe 안에서도 깨지지 않음, 블로그 링크 `target="_top"` 동작
- [ ] UI 글자 대비 4.5:1 이상, 빛번짐은 제목·선택된 도구 버튼에만
- [ ] 버튼·팔레트 터치 대상 44×44px 이상, `:focus-visible` 표시
- [ ] `prefers-reduced-motion: reduce`에서 애니메이션 꺼짐
- [ ] 외부 라이브러리 없음(Gaegu만), 블로그 css/js import 없음, UI 색은 `:root` 변수만 사용
- [ ] 그림 데이터 로직이 logic.js 순수 함수로 분리되어 DOM에 의존하지 않는다
- [ ] 코드 스타일: 2칸 들여쓰기, 세미콜론, const/let, 한국어 주석·문구, 콘솔 오류 없음
