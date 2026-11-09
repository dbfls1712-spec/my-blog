// 다크 모드 토글. 초기 테마는 index.html <head>의 인라인 스크립트가 적용합니다.

const STORAGE_KEY = 'theme';
const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (e) {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    // 저장할 수 없어도 현재 화면에는 적용됩니다.
  }
}

function currentTheme() {
  return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function initThemeToggle(button) {
  const updateLabel = () => {
    const isDark = currentTheme() === 'dark';
    button.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    button.title = isDark ? '라이트 모드' : '다크 모드';
  };

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store(next);
    updateLabel();
  });

  // 직접 고른 적이 없으면 OS 설정이 바뀔 때 따라갑니다.
  darkQuery.addEventListener('change', (event) => {
    if (readStored()) return;
    root.setAttribute('data-theme', event.matches ? 'dark' : 'light');
    updateLabel();
  });

  updateLabel();
}
