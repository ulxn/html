(() => {
  'use strict';

  const boot = window.__LITTLE_VIEWER_BOOT__;
  delete window.__LITTLE_VIEWER_BOOT__;
  if (!boot || typeof boot.token !== 'string') return;

  const saved = boot.state && typeof boot.state === 'object' ? boot.state : {};
  const local = { ...(saved.local || {}) };
  const session = { ...(saved.session || {}) };
  const actions = Array.isArray(saved.actions) ? saved.actions.slice(0, 120) : [];
  let replaying = false;
  let scrollY = Number(saved.scrollY) || 0;
  let scrollTimer;
  let custom = saved.custom ?? null;
  // Answers in some interactive quizzes live only in JavaScript variables.
  // Persist their visible semantics without requiring the uploaded HTML to change.
  let quiz = saved.quiz && typeof saved.quiz === 'object'
    ? {
        answers: saved.quiz.answers && typeof saved.quiz.answers === 'object' ? { ...saved.quiz.answers } : {},
        currentId: saved.quiz.currentId || null,
        category: saved.quiz.category || 'ALL',
        instantMode: saved.quiz.instantMode !== false
      }
    : null;

  const checkpoint = () => {
    if (replaying) return;
    window.parent.postMessage({
      channel: 'little-viewer-state', token: boot.token,
      state: { local, session, actions, scrollY, custom, quiz }
    }, '*');
  };

  const storage = map => ({
    get length() { return Object.keys(map).length; },
    key(index) { return Object.keys(map)[index] ?? null; },
    getItem(key) { key = String(key); return Object.hasOwn(map, key) ? map[key] : null; },
    setItem(key, value) {
      key = String(key);
      value = String(value);
      if (key.length > 256 || value.length > 32000) return;
      map[key] = value;
      checkpoint();
    },
    removeItem(key) { delete map[String(key)]; checkpoint(); },
    clear() { for (const key of Object.keys(map)) delete map[key]; checkpoint(); }
  });

  // about:srcdoc with an opaque origin normally cannot use browser storage.
  // A synchronous, document-local shim forwards writes to the viewer's IndexedDB.
  for (const [name, value] of [['localStorage', storage(local)], ['sessionStorage', storage(session)]]) {
    try { Object.defineProperty(window, name, { configurable: true, value }); } catch { /* Browser restrictions may prevent this. */ }
  }

  // Optional explicit state API for quizzes with custom JavaScript state.
  window.littleViewer = {
    load() { return custom; },
    save(value) {
      try {
        const data = JSON.stringify(value);
        if (data && data.length < 32000) {
          custom = JSON.parse(data);
          checkpoint();
        }
      } catch { /* Ignore non-serializable values. */ }
    }
  };

  function selector(element) {
    if (element.id && window.CSS?.escape) return '#' + CSS.escape(element.id);
    const parts = [];
    for (let el = element; el && el.nodeType === 1 && el !== document.documentElement; el = el.parentElement) {
      let index = 1;
      for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (sib.localName === el.localName) index++;
      }
      parts.unshift(`${el.localName}:nth-of-type(${index})`);
      if (parts.length >= 16) break;
    }
    return parts.join(' > ');
  }

  function record(action, replace = false) {
    if (replaying) return;
    const last = actions[actions.length - 1];
    if (replace && last?.type === action.type && last.selector === action.selector) {
      actions[actions.length - 1] = action;
    } else {
      actions.push(action);
      if (actions.length > 120) actions.shift();
    }
    checkpoint();
  }

  function eligibleField(el) {
    if (!el || !el.matches('input, select, textarea')) return false;
    if (el.matches('input[type=password], input[type=file], input[type=hidden]')) return false;
    if (el.autocomplete && /(?:cc-|password|one-time-code)/i.test(el.autocomplete)) return false;
    return true;
  }

  function trackField(el) {
    if (!eligibleField(el)) return;
    const action = {
      type: 'field', selector: selector(el),
      value: String(el.value).slice(0, 2000), checked: Boolean(el.checked)
    };
    record(action, true);
  }
  document.addEventListener('change', event => trackField(event.target));
  document.addEventListener('input', event => {
    const el = event.target;
    if (eligibleField(el) && !/^(radio|checkbox)$/i.test(el.type)) trackField(el);
  });

  document.addEventListener('click', event => {
    if (replaying || !(event.target instanceof Element)) return;
    const el = event.target.closest('button, [role=button], input[type=button], a[href^="#"]');
    if (!el || el.matches('[type=submit], [type=reset]')) return;
    if (el.closest('form[action]:not([action=""]):not([action="#"])')) return;
    const label = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 80);
    const hint = `${label} ${el.id} ${el.getAttribute('data-action') || ''}`;
    if (!/\b(next|previous|prev|back|continue|start|begin|skip|lanjut|selanjutnya|sebelumnya|kembali|mulai|berikutnya)\b/i.test(hint)) return;
    record({ type: 'click', selector: selector(el), label });
  });

  // Quiz adapter: the two supplied UPKP/TPA quizzes (and similarly structured
  // quizzes) use dynamic buttons and private JS state rather than form inputs.
  // A generic Next/Back replay cannot restore their selected answers.
  const hasQuiz = () => Boolean(
    document.querySelector('#options-container') &&
    document.querySelector('#quick-nav') &&
    document.querySelector('#badge-num')
  );
  const currentQuestionId = () => {
    const label = document.querySelector('#badge-num')?.textContent || '';
    const match = label.match(/(?:soal|nomor)\s*#?\s*(\d+)/i);
    return match ? match[1] : null;
  };
  const questionNumberButtons = () => [...document.querySelectorAll('#quick-nav button')];
  const optionButtons = () => [...document.querySelectorAll('#options-container button')];
  const optionKey = element => (element.querySelector('span')?.textContent || '').trim().toUpperCase();
  const activeMode = () => !/ujian|sembunyi/i.test(document.querySelector('#instant-label')?.textContent || '');
  function captureQuiz() {
    if (replaying || !hasQuiz()) return;
    if (!quiz) quiz = { answers: {}, currentId: null, category: 'ALL', instantMode: true };
    quiz.currentId = currentQuestionId();
    quiz.category = document.querySelector('#category-filter')?.value || 'ALL';
    quiz.instantMode = activeMode();
    checkpoint();
  }
  document.addEventListener('click', event => {
    if (replaying || !hasQuiz() || !(event.target instanceof Element)) return;
    const button = event.target.closest('button');
    if (!button) return;
    if (!quiz) quiz = { answers: {}, currentId: null, category: 'ALL', instantMode: true };
    const id = currentQuestionId();
    if (id && button.closest('#options-container')) {
      const key = optionKey(button);
      if (/^[A-Z]$/.test(key)) quiz.answers[id] = key;
    } else if (id && button.id === 'reset-current-btn') {
      delete quiz.answers[id];
    } else if (button.id === 'modal-reset') {
      quiz.answers = {};
    }
    // The quiz's button handlers update the question synchronously at target.
    // Read its new active number after those handlers finish.
    queueMicrotask(captureQuiz);
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.id === 'category-filter') queueMicrotask(captureQuiz);
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') queueMicrotask(captureQuiz);
  }, true);

  async function restoreQuiz() {
    if (!quiz || !hasQuiz()) return false;
    const savedQuiz = {
      answers: { ...quiz.answers }, currentId: quiz.currentId,
      category: quiz.category, instantMode: quiz.instantMode
    };
    // The quiz begins in its ALL category. Visit each saved question by ID,
    // select its saved answer, and restore the user's filter and active question.
    const entries = Object.entries(savedQuiz.answers).slice(0, 500);
    for (let i = 0; i < entries.length; i++) {
      const [id, key] = entries[i];
      const nav = questionNumberButtons().find(button => button.textContent.trim() === String(id));
      if (!nav) continue;
      nav.click();
      const option = optionButtons().find(button => optionKey(button) === key);
      if (option) option.click();
      if (i && i % 24 === 0) await delay(0);
    }
    if (activeMode() !== savedQuiz.instantMode) document.querySelector('#toggle-instant-btn')?.click();
    const filter = document.querySelector('#category-filter');
    if (filter && [...filter.options].some(option => option.value === savedQuiz.category)) {
      if (filter.value !== savedQuiz.category) {
        filter.value = savedQuiz.category;
        filter.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (savedQuiz.currentId != null) {
      const nav = questionNumberButtons().find(button => button.textContent.trim() === String(savedQuiz.currentId));
      nav?.click();
    }
    return true;
  }

  window.addEventListener('scroll', () => {
    if (replaying) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollY = window.scrollY;
      checkpoint();
    }, 180);
  }, { passive: true });

  // Replay only ordinary quiz navigation, not arbitrary clicks or submissions.
  // If a quiz already persists its own current step, don't advance it twice.
  const ownsProgress = Object.keys({ ...local, ...session })
    .some(key => /(?:question|quiz|step|progress|current|page|index)/i.test(key));

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function replay() {
    if (!actions.length && !scrollY && !quiz) return;
    replaying = true;
    try {
      // Restores selected options as well as the active question, not just
      // the sequence of Next clicks. No modification of the HTML file needed.
      if (await restoreQuiz()) {
        if (scrollY) window.scrollTo(0, scrollY);
        return;
      }
      if (!ownsProgress) {
        for (const action of actions) {
          let el = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            try { el = document.querySelector(action.selector); } catch { break; }
            if (el) break;
            await delay(60);
          }
          if (!el) break;
          if (action.type === 'field' && eligibleField(el)) {
            el.value = action.value;
            if ('checked' in el && /^(checkbox|radio)$/i.test(el.type)) el.checked = action.checked;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (action.type === 'click' && el.matches('button, [role=button], input[type=button], a[href^="#"]')) {
            el.click();
          }
          await delay(55);
        }
      }
      if (scrollY) window.scrollTo(0, scrollY);
    } finally {
      replaying = false;
      if (quiz && hasQuiz()) captureQuiz();
    }
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(replay, 120), { once: true });
})();
