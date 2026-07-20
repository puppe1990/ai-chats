import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { AppReadyGate } from '../components/AppReadyGate'
import {
  STARTUP_LOADER_CRITICAL_CSS,
  STARTUP_LOADER_DISMISS_SCRIPT,
  STARTUP_LOADER_HTML,
} from '../lib/startup-loader'
import Footer from '../components/Footer'
import Header from '../components/Header'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=stored==='dark'?'dark':'light';var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(mode);root.setAttribute('data-theme',mode);root.style.colorScheme=mode;}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'AI Chats',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: STARTUP_LOADER_CRITICAL_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: STARTUP_LOADER_DISMISS_SCRIPT }} />
        <HeadContent />
      </head>
      <body
        className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]"
        suppressHydrationWarning
      >
        {/*
          suppressHydrationWarning: the inline dismiss script may hide this node
          before React hydrates. Without this, hydration errors leave the UI
          non-interactive (only plain <a> navigation works).
        */}
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: STARTUP_LOADER_HTML }}
        />
        <AppReadyGate />
        <Header />
        {children}
        <Footer />
        <Scripts />
      </body>
    </html>
  )
}
