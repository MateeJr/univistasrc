"use client";

import React from 'react';
import Image from 'next/image';

interface Truck3DProps {
  rotation?: number; // Rotation in degrees (0 = north, 90 = east, etc.)
  size?: number; // Size multiplier
  color?: string; // Truck color (not used with PNG but kept for compatibility)
  isDark?: boolean; // Dark theme (not used with PNG but kept for compatibility)
}

const Truck3D: React.FC<Truck3DProps> = ({
  rotation = 0,
  size = 1,
  color = '#3b82f6',
  isDark = false
}) => {
  // Calculate the actual size - make it larger as requested
  const actualSize = Math.max(32, 32 * size * 2); // Double the size and minimum 32px

  return (
    <div
      style={{
        width: `${actualSize}px`,
        height: `${actualSize}px`,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Image
        src="/truck.png"
        alt="Truck"
        width={actualSize}
        height={actualSize}
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: 'center',
          filter: isDark ? 'brightness(0.8)' : 'none'
        }}
        priority
      />
    </div>
  );
};

export default Truck3D;
