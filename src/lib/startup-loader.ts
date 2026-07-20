export function dismissStartupLoader() {
  if (typeof document === 'undefined') return false

  const loader = document.getElementById('app-startup-loader')
  if (!loader || loader.dataset.dismissed === 'true') return false

  loader.dataset.dismissed = 'true'
  loader.classList.add('startup-loader--hide')
  document.documentElement.setAttribute('data-app-ready', 'true')

  window.setTimeout(() => {
    loader.remove()
  }, 320)

  return true
}

export const STARTUP_LOADER_HTML = `
  <div id="app-startup-loader" class="startup-loader" aria-live="polite" aria-busy="true" aria-label="Carregando AI Chats">
    <div class="startup-loader__card">
      <div class="startup-loader__spinner" aria-hidden="true"></div>
      <p class="startup-loader__title">AI Chats</p>
      <p class="startup-loader__subtitle">Carregando sessões do Cursor, Grok, Codex, OpenCode e Claude Code…</p>
    </div>
  </div>
`.trim()

export const STARTUP_LOADER_DISMISS_SCRIPT = `
(function () {
  function dismissStartupLoader() {
    var loader = document.getElementById('app-startup-loader')
    if (!loader || loader.dataset.dismissed === 'true') return
    loader.dataset.dismissed = 'true'
    loader.classList.add('startup-loader--hide')
    document.documentElement.setAttribute('data-app-ready', 'true')
    window.setTimeout(function () {
      loader.remove()
    }, 320)
  }

  function hasAppContent() {
    var main = document.querySelector('main')
    return !!(main && main.innerText.trim().length > 0)
  }

  function check() {
    if (hasAppContent()) dismissStartupLoader()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check)
  } else {
    check()
  }

  window.addEventListener('load', check)

  var observer = new MutationObserver(check)
  function observe() {
    if (!document.body) return
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  if (document.body) observe()
  else document.addEventListener('DOMContentLoaded', observe)

  window.setTimeout(dismissStartupLoader, 45000)
})()
`.trim()

export const STARTUP_LOADER_CRITICAL_CSS = `
  .startup-loader {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background:
      radial-gradient(1100px 620px at -8% -10%, rgba(79, 184, 178, 0.36), transparent 58%),
      radial-gradient(1050px 620px at 112% -12%, rgba(47, 106, 74, 0.2), transparent 62%),
      linear-gradient(180deg, #edf5ef 0%, #e7f3ec 44%, #dfeee8 100%);
    transition: opacity 0.3s ease, visibility 0.3s ease;
  }
  .startup-loader--hide,
  html[data-app-ready='true'] #app-startup-loader {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  html[data-app-ready='true'] #app-startup-loader {
    display: none !important;
  }
  .startup-loader__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    min-width: min(100%, 20rem);
    padding: 1.75rem 2rem;
    border-radius: 1.25rem;
    border: 1px solid rgba(47, 106, 74, 0.14);
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 18px 48px rgba(30, 90, 72, 0.12);
    text-align: center;
  }
  .startup-loader__spinner {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    border: 3px solid rgba(79, 184, 178, 0.22);
    border-top-color: #4fb8b2;
    animation: startup-loader-spin 0.85s linear infinite;
  }
  .startup-loader__title {
    margin: 0;
    font: 600 1.125rem/1.2 Manrope, ui-sans-serif, system-ui, sans-serif;
    color: #173a40;
  }
  .startup-loader__subtitle {
    margin: 0;
    max-width: 16rem;
    font: 500 0.8125rem/1.45 Manrope, ui-sans-serif, system-ui, sans-serif;
    color: #416166;
  }
  @keyframes startup-loader-spin {
    to { transform: rotate(360deg); }
  }
  html[data-theme='dark'] .startup-loader {
    background:
      radial-gradient(1100px 620px at -8% -10%, rgba(96, 215, 207, 0.18), transparent 58%),
      radial-gradient(1050px 620px at 112% -12%, rgba(110, 200, 154, 0.12), transparent 62%),
      linear-gradient(180deg, #0a1418 0%, #0f1a1e 100%);
  }
  html[data-theme='dark'] .startup-loader__card {
    border-color: rgba(141, 229, 219, 0.18);
    background: rgba(15, 27, 31, 0.92);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  }
  html[data-theme='dark'] .startup-loader__title { color: #d7ece8; }
  html[data-theme='dark'] .startup-loader__subtitle { color: #afcdc8; }
  html[data-theme='dark'] .startup-loader__spinner {
    border-color: rgba(96, 215, 207, 0.2);
    border-top-color: #60d7cf;
  }
`.trim()
