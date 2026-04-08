import React, { useEffect } from 'react';

interface SecurityOverlayProps {
  children: React.ReactNode;
}

export const SecurityOverlay: React.FC<SecurityOverlayProps> = ({ children }) => {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
    };
  }, []);

  return (
    <div
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', height: '100%' }}
    >
      {children}
    </div>
  );
};
