import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { FONTS } from '../constants';

export interface CaptionSegment {
  text: string;
  startFrame: number;
  endFrame: number;
}

interface CaptionProps {
  segments: CaptionSegment[];
}

export const Caption: React.FC<CaptionProps> = ({ segments }) => {
  const frame = useCurrentFrame();

  // Find active caption
  const active = segments.find(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );

  if (!active) return null;

  const fadeIn = interpolate(
    frame,
    [active.startFrame, active.startFrame + 15],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const fadeOut = interpolate(
    frame,
    [active.endFrame - 15, active.endFrame],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '20px 60px 28px',
        background:
          'linear-gradient(transparent, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85))',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      <p
        style={{
          fontFamily: FONTS.serif,
          fontSize: 26,
          color: 'rgba(255,255,255,0.95)',
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.4,
          maxWidth: 900,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {active.text}
      </p>
    </div>
  );
};
