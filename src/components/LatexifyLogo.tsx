import React from 'react';
import Image from 'next/image';

interface LatexifyLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string; // Kept for interface compatibility but ignored by raster image
  forceTheme?: 'light' | 'dark'; // Force a specific theme representation
}

export default function LatexifyLogo({ size = 32, className = '', style = {}, forceTheme }: LatexifyLogoProps) {
  // Determine if it should be inverted (white text logo)
  const isInverted = className.includes('text-white') || className.includes('invert') || className.includes('text-light');
  
  let filterStyle = style.filter || undefined;
  if (isInverted || forceTheme === 'dark') {
    filterStyle = 'brightness(0) invert(1)';
  } else if (forceTheme === 'light') {
    filterStyle = 'none';
  }

  const imgClass = forceTheme === 'light'
    ? 'transition-all duration-300'
    : 'dark:brightness-0 dark:invert transition-all duration-300';

  return (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', height: size }}>
      <Image
        src="/logo.png"
        alt="Latexify Logo"
        width={0}
        height={0}
        sizes="100%"
        className={imgClass}
        style={{ 
          height: '100%', 
          width: 'auto', 
          objectFit: 'contain', 
          maxWidth: '240px',
          filter: filterStyle
        }}
      />
    </div>
  );
}
