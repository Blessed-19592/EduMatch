import { useState } from 'react';
import './ImageAvatar.css';

export default function ImageAvatar({ src, name, className = '', fallback }) {
  const [failedSource, setFailedSource] = useState('');
  const normalizedName = String(name || '').trim();
  const initials = normalizedName
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      className={`image-avatar ${className}`.trim()}
      role="img"
      aria-label={`${normalizedName || 'User'} picture`}
    >
      {src && failedSource !== src
        ? <img src={src} alt="" onError={() => setFailedSource(src)} />
        : fallback ?? initials}
    </div>
  );
}
