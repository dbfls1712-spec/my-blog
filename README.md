# RIN

마크다운으로 쓴 글을 보여주는 블로그입니다. 프레임워크나 빌드 과정 없이 HTML, CSS, JavaScript만으로 동작합니다.

## 실행하기

브라우저가 글 파일을 `fetch`로 불러오기 때문에 `index.html`을 더블클릭해서 열면 동작하지 않습니다. 이 폴더에서 로컬 서버를 실행하세요.

```bash
python -m http.server 8000
```

그다음 브라우저에서 <http://localhost:8000>을 엽니다.

## 새 글 추가하기

1. `posts/` 폴더에 `<slug>.md` 파일을 만듭니다. slug는 영문 소문자, 숫자, 하이픈만 씁니다. (예: `my-first-trip.md`)
2. 파일 맨 위에 글 정보를 적고, 그 아래에 본문을 씁니다.

   ```markdown
   ---
   title: 글 제목
   date: 2026-11-10
   tags: [일상, 여행]
   description: 목록에 보일 한두 문장 요약
   draft: false
   ---

   본문은 여기부터 씁니다.
   ```

3. `posts/posts.json`에 같은 정보를 한 줄 추가합니다. 브라우저는 폴더 안의 파일 목록을 직접 읽을 수 없어서 이 목록이 필요합니다.

   ```json
   { "slug": "my-first-trip", "title": "글 제목", "date": "2026-11-10", "tags": ["일상", "여행"], "description": "...", "draft": false }
   ```

   `draft`를 `true`로 두면(두 곳 모두) 블로그 목록에 보이지 않고, 주소로 직접 열어도 "글을 찾을 수 없습니다"가 뜹니다. 공개할 때 `false`로 바꾸세요.

   항목 사이에 쉼표를 빠뜨리면 목록 전체가 열리지 않으니 주의하세요.

4. 이미지는 `images/` 폴더에 넣고 본문에서 `![설명](images/파일이름.png)`처럼 씁니다.

지원하는 마크다운 문법은 `posts/markdown-test.md`에서 볼 수 있습니다.

## 파일 구조

| 경로 | 역할 |
| --- | --- |
| `index.html` | 페이지 뼈대, 테마 초기 적용 |
| `css/style.css` | 전체 디자인, 라이트·다크 색 |
| `js/app.js` | 주소(`#/…`)에 따라 화면 전환 |
| `js/markdown.js` | 마크다운 → HTML 변환 |
| `js/theme.js` | 다크 모드 버튼 |
| `posts/` | 글과 글 목록(`posts.json`) |
| `images/` | 글에 쓰는 이미지 |
