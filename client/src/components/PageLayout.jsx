import { useEffect, useState } from 'react';
import './PageLayout.css';

function isTextInput(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'hidden', 'image'].includes(type);
}

export default function PageLayout({
  children,
  footerSrc = '/assets/Deco2.png',
  footerExtra = null,
  footerOverlay = null,
  mainClassName = '',
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    let focusCount = 0;

    const syncKeyboard = () => {
      const vv = window.visualViewport;
      const viewportShrunk = vv ? vv.height < window.innerHeight * 0.82 : false;
      setKeyboardOpen(focusCount > 0 || viewportShrunk);
    };

    const onFocusIn = (e) => {
      if (isTextInput(e.target)) {
        focusCount += 1;
        syncKeyboard();
      }
    };

    const onFocusOut = (e) => {
      if (isTextInput(e.target)) {
        focusCount = Math.max(0, focusCount - 1);
        window.setTimeout(syncKeyboard, 80);
      }
    };

    const onViewportChange = () => syncKeyboard();

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, []);

  const layoutClass = keyboardOpen ? 'page-layout page-layout--keyboard-open' : 'page-layout';

  return (
    <div className={layoutClass}>
      <div className={`page-layout__main ${mainClassName}`.trim()}>{children}</div>
      <footer className="page-layout__footer" aria-hidden={!footerOverlay}>
        {footerExtra}
        {footerOverlay && (
          <div className="page-layout__footer-overlay">{footerOverlay}</div>
        )}
        <img src={footerSrc} alt="" className="page-layout__footer-img" />
      </footer>
    </div>
  );
}
