import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  clicking?: boolean;
  hidden?: boolean;
}

interface CursorProps {
  keyframes: CursorKeyframe[];
}

export const Cursor: React.FC<CursorProps> = ({ keyframes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the two surrounding keyframes for interpolation
  let prevKf = keyframes[0];
  let nextKf = keyframes[0];

  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].frame <= frame) {
      prevKf = keyframes[i];
      nextKf = keyframes[i + 1] || keyframes[i];
    }
  }

  // If cursor is hidden at current keyframe, don't render
  if (prevKf.hidden && frame < nextKf.frame) {
    return null;
  }

  // Spring-based position interpolation
  const frameDelta = nextKf.frame - prevKf.frame;
  const progress =
    frameDelta > 0
      ? spring({
          frame: Math.max(0, frame - prevKf.frame),
          fps,
          config: { damping: 20, mass: 0.5, stiffness: 120 },
          durationInFrames: Math.min(frameDelta, 30),
        })
      : 1;

  const x = interpolate(progress, [0, 1], [prevKf.x, nextKf.x]);
  const y = interpolate(progress, [0, 1], [prevKf.y, nextKf.y]);

  // Click ripple effect
  const isClicking = prevKf.clicking && frame >= prevKf.frame && frame < prevKf.frame + 12;
  const clickFrame = isClicking ? frame - prevKf.frame : 0;
  const rippleScale = isClicking
    ? interpolate(clickFrame, [0, 12], [0.5, 2.5], { extrapolateRight: 'clamp' })
    : 0;
  const rippleOpacity = isClicking
    ? interpolate(clickFrame, [0, 12], [0.5, 0], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Click ripple */}
      {isClicking && (
        <div
          style={{
            position: 'absolute',
            left: x - 20,
            top: y - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            transform: `scale(${rippleScale})`,
            opacity: rippleOpacity,
          }}
        />
      )}

      {/* Cursor dot */}
      <div
        style={{
          position: 'absolute',
          left: x - 8,
          top: y - 8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.3)',
          transform: isClicking ? 'scale(0.8)' : 'scale(1)',
          transition: 'transform 0.05s',
        }}
      />
    </AbsoluteFill>
  );
};
