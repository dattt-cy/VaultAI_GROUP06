import React, { useEffect } from 'react';

interface SecurityOverlayProps {
  children: React.ReactNode;
}

export const SecurityOverlay: React.FC<SecurityOverlayProps> = ({ children }) => {
  // Không dùng document-level listener vì sẽ block copy toàn trang
  // Chỉ block trong phạm vi element này qua React event handlers
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
