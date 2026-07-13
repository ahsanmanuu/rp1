'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface LatexifyLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  forceTheme?: 'light' | 'dark';
  src?: string;
}

export default function LatexifyLogo({ size = 32, className = '', style = {}, forceTheme, src }: LatexifyLogoProps) {
  const [dynamicSrc, setDynamicSrc] = useState<string>(src || '/logo.png');

  useEffect(() => {
    if (src) {
      setDynamicSrc(src);
      return;
    }
    const controller = new AbortController();
    fetch('/api/logo', { signal: controller.signal })
      .then(r => r.json())
      .then(data => { if (data?.url && !controller.signal.aborted) setDynamicSrc(data.url); })
      .catch(() => {});
    return () => controller.abort();
  }, [src]);

  const isInverted = className.includes('text-white') || className.includes('invert') || className.includes('text-light');
  let filterStyle = style.filter || undefined;
  if (isInverted || forceTheme === 'dark') filterStyle = 'brightness(0) invert(1)';
  else if (forceTheme === 'light') filterStyle = 'none';

  const imgClass = forceTheme === 'light'
    ? 'transition-all duration-300'
    : 'dark:brightness-0 dark:invert transition-all duration-300';

  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', height: size }}>
      <Image
        src={dynamicSrc}
        alt="Latexify Logo"
        width={0}
        height={0}
        sizes="100%"
        className={imgClass}
        unoptimized={dynamicSrc.startsWith('http')}
        style={{
          height: '100%',
          width: 'auto',
          objectFit: 'contain',
          maxWidth: '240px',
          filter: filterStyle,
        }}
      />
    </div>
  );
}
