import { useState, useEffect } from 'react';
import './MobileOnly.css';

const MOBILE_MAX_WIDTH = 480;

export default function MobileOnly({ children }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_MAX_WIDTH);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_MAX_WIDTH);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isMobile) {
    return (
      <div className="desktop-block">
        <div className="desktop-block__content">
          <p className="desktop-block__text">請使用手機查看</p>
        </div>
      </div>
    );
  }

  return children;
}
