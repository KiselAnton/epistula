import Image from 'next/image';
import { CSSProperties, useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
  fallbackIcon?: React.ReactNode; // optional emoji/icon fallback
}

export default function SafeImage({ src, alt, width, height, className, style, fallbackIcon }: SafeImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: 'grid',
          placeItems: 'center',
          background: '#f8f9fa',
          border: '1px solid #eee',
          borderRadius: 8,
          overflow: 'hidden',
          ...style,
        }}
        aria-label={alt}
        title={alt}
      >
        {fallbackIcon ?? '🏛️'}
      </div>
    );
  }

  // Use unoptimized to bypass Next.js image optimizer (_next/image), avoiding 400s on large originals.
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      unoptimized
      onError={() => setErrored(true)}
    />
  );
}
