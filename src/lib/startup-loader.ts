export function dismissStartupLoader() {
  if (typeof document === 'undefined') return false

  const loader = document.getElementById('app-startup-loader')
  if (!loader || loader.dataset.dismissed === 'true') return false

  loader.dataset.dismissed = 'true'
  loader.classList.add('startup-loader--hide')
  document.documentElement.setAttribute('data-app-ready', 'true')

  window.setTimeout(() => {
    loader.remove()
  }, 420)

  return true
}

export const STARTUP_LOADER_HTML = `
  <div id="app-startup-loader" class="startup-loader" aria-live="polite" aria-busy="true" aria-label="Carregando AI Chats">
    <div class="startup-loader__glow" aria-hidden="true"></div>
    <div class="startup-loader__card">
      <div class="startup-loader__mark" aria-hidden="true">
        <div class="startup-loader__orbit startup-loader__orbit--outer"></div>
        <div class="startup-loader__orbit startup-loader__orbit--inner"></div>
        <div class="startup-loader__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/>
          </svg>
        </div>
      </div>
      <p class="startup-loader__title">AI Chats</p>
      <p class="startup-loader__subtitle">Unificando sessões do Cursor, Grok, Codex, OpenCode e Claude…</p>
      <div class="startup-loader__dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="startup-loader__bar" aria-hidden="true">
        <div class="startup-loader__bar-fill"></div>
      </div>
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
    }, 420)
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
    overflow: hidden;
    background:
      radial-gradient(1100px 620px at -8% -10%, rgba(79, 184, 178, 0.36), transparent 58%),
      radial-gradient(1050px 620px at 112% -12%, rgba(47, 106, 74, 0.2), transparent 62%),
      linear-gradient(180deg, #edf5ef 0%, #e7f3ec 44%, #dfeee8 100%);
    transition: opacity 0.4s ease, visibility 0.4s ease, transform 0.4s ease;
  }
  .startup-loader__glow {
    position: absolute;
    width: min(28rem, 80vw);
    height: min(28rem, 80vw);
    border-radius: 999px;
    background: radial-gradient(circle, rgba(79, 184, 178, 0.28) 0%, transparent 68%);
    filter: blur(8px);
    animation: startup-loader-pulse 2.4s ease-in-out infinite;
    pointer-events: none;
  }
  .startup-loader--hide,
  html[data-app-ready='true'] #app-startup-loader {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: scale(1.02);
  }
  html[data-app-ready='true'] #app-startup-loader {
    display: none !important;
  }
  .startup-loader__card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.85rem;
    min-width: min(100%, 21rem);
    max-width: 22rem;
    padding: 2rem 2.1rem 1.75rem;
    border-radius: 1.5rem;
    border: 1px solid rgba(47, 106, 74, 0.14);
    background: rgba(255, 255, 255, 0.9);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.9) inset,
      0 24px 64px rgba(30, 90, 72, 0.14);
    text-align: center;
    backdrop-filter: blur(12px);
    animation: startup-loader-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .startup-loader__mark {
    position: relative;
    width: 5.25rem;
    height: 5.25rem;
    display: grid;
    place-items: center;
    margin-bottom: 0.15rem;
  }
  .startup-loader__orbit {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    border: 2px solid transparent;
  }
  .startup-loader__orbit--outer {
    border-top-color: #4fb8b2;
    border-right-color: rgba(79, 184, 178, 0.25);
    animation: startup-loader-spin 1.1s linear infinite;
  }
  .startup-loader__orbit--inner {
    inset: 0.55rem;
    border-bottom-color: #2f6a4a;
    border-left-color: rgba(47, 106, 74, 0.22);
    animation: startup-loader-spin 0.85s linear infinite reverse;
  }
  .startup-loader__icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.95rem;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(145deg, #56c6be 0%, #2f6a4a 100%);
    box-shadow:
      0 10px 24px rgba(47, 106, 74, 0.28),
      0 0 0 4px rgba(79, 184, 178, 0.12);
    animation: startup-loader-float 2.2s ease-in-out infinite;
  }
  .startup-loader__icon svg {
    width: 1.45rem;
    height: 1.45rem;
  }
  .startup-loader__title {
    margin: 0;
    font: 700 1.35rem/1.15 Manrope, ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.02em;
    color: #173a40;
  }
  .startup-loader__subtitle {
    margin: 0;
    max-width: 17rem;
    font: 500 0.8125rem/1.5 Manrope, ui-sans-serif, system-ui, sans-serif;
    color: #416166;
  }
  .startup-loader__dots {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.15rem;
  }
  .startup-loader__dots span {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
    background: #4fb8b2;
    opacity: 0.35;
    animation: startup-loader-dot 1.2s ease-in-out infinite;
  }
  .startup-loader__dots span:nth-child(2) { animation-delay: 0.15s; }
  .startup-loader__dots span:nth-child(3) { animation-delay: 0.3s; }
  .startup-loader__bar {
    width: 100%;
    height: 0.28rem;
    margin-top: 0.35rem;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(79, 184, 178, 0.14);
  }
  .startup-loader__bar-fill {
    width: 40%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #4fb8b2, #2f6a4a, #4fb8b2);
    background-size: 200% 100%;
    animation: startup-loader-bar 1.35s ease-in-out infinite;
  }
  @keyframes startup-loader-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes startup-loader-pulse {
    0%, 100% { opacity: 0.55; transform: scale(0.92); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  @keyframes startup-loader-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  @keyframes startup-loader-dot {
    0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }
  @keyframes startup-loader-bar {
    0% { transform: translateX(-120%); background-position: 0% 0; }
    100% { transform: translateX(280%); background-position: 100% 0; }
  }
  @keyframes startup-loader-enter {
    from { opacity: 0; transform: translateY(10px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  html[data-theme='dark'] .startup-loader {
    background:
      radial-gradient(1100px 620px at -8% -10%, rgba(96, 215, 207, 0.18), transparent 58%),
      radial-gradient(1050px 620px at 112% -12%, rgba(110, 200, 154, 0.12), transparent 62%),
      linear-gradient(180deg, #0a1418 0%, #0f1a1e 100%);
  }
  html[data-theme='dark'] .startup-loader__glow {
    background: radial-gradient(circle, rgba(96, 215, 207, 0.16) 0%, transparent 68%);
  }
  html[data-theme='dark'] .startup-loader__card {
    border-color: rgba(141, 229, 219, 0.18);
    background: rgba(15, 27, 31, 0.94);
    box-shadow:
      0 1px 0 rgba(194, 247, 238, 0.08) inset,
      0 24px 64px rgba(0, 0, 0, 0.4);
  }
  html[data-theme='dark'] .startup-loader__title { color: #d7ece8; }
  html[data-theme='dark'] .startup-loader__subtitle { color: #afcdc8; }
  html[data-theme='dark'] .startup-loader__orbit--outer {
    border-top-color: #60d7cf;
    border-right-color: rgba(96, 215, 207, 0.2);
  }
  html[data-theme='dark'] .startup-loader__orbit--inner {
    border-bottom-color: #6ec89a;
    border-left-color: rgba(110, 200, 154, 0.2);
  }
  html[data-theme='dark'] .startup-loader__dots span { background: #60d7cf; }
  html[data-theme='dark'] .startup-loader__bar {
    background: rgba(96, 215, 207, 0.12);
  }
  html[data-theme='dark'] .startup-loader__bar-fill {
    background: linear-gradient(90deg, #60d7cf, #6ec89a, #60d7cf);
    background-size: 200% 100%;
  }
  @media (prefers-reduced-motion: reduce) {
    .startup-loader__orbit,
    .startup-loader__icon,
    .startup-loader__dots span,
    .startup-loader__bar-fill,
    .startup-loader__glow,
    .startup-loader__card {
      animation: none !important;
    }
  }
`.trim()
