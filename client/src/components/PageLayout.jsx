import './PageLayout.css';

export default function PageLayout({
  children,
  footerSrc = '/assets/Deco2.png',
  footerExtra = null,
  footerOverlay = null,
  mainClassName = '',
}) {
  return (
    <div className="page-layout">
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
