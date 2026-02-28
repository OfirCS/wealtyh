import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../constants';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Line 1: "Every Canadian facing a major life change"
  const line1Opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const line1Y = interpolate(frame, [0, 30], [20, 0], { extrapolateRight: 'clamp' });

  // Line 2: "tries to mentally calculate the cascade."
  const line2Opacity = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: 'clamp' });
  const line2Y = interpolate(frame, [25, 55], [20, 0], { extrapolateRight: 'clamp' });

  // Line 3: subtitle
  const line3Opacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' });

  // Fade out problem block
  const problemOpacity = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Solution title: "Introducing Pathfinder"
  const solutionProgress = spring({ frame: Math.max(0, frame - 190), fps, config: { damping: 15, mass: 0.8 } });
  const solutionOpacity = interpolate(frame, [190, 220], [0, 1], { extrapolateRight: 'clamp' });

  // Solution subtitle
  const subOpacity = interpolate(frame, [230, 260], [0, 1], { extrapolateRight: 'clamp' });

  // Overall fade out
  const fadeOut = interpolate(frame, [300, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeOut,
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(62,201,122,0.06) 0%, transparent 70%)`,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div style={{ maxWidth: 950, textAlign: 'center', padding: 40, position: 'relative' }}>
        {/* Problem text */}
        <div style={{ opacity: problemOpacity }}>
          <p
            style={{
              fontFamily: FONTS.serif,
              fontSize: 52,
              color: COLORS.textPrimary,
              lineHeight: 1.3,
              opacity: line1Opacity,
              transform: `translateY(${line1Y}px)`,
              margin: 0,
            }}
          >
            Every Canadian facing a major life change
          </p>
          <p
            style={{
              fontFamily: FONTS.serif,
              fontSize: 52,
              color: COLORS.textPrimary,
              lineHeight: 1.3,
              opacity: line2Opacity,
              transform: `translateY(${line2Y}px)`,
              marginTop: 8,
            }}
          >
            tries to mentally calculate the cascade.
          </p>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 22,
              color: COLORS.textSecondary,
              marginTop: 30,
              opacity: line3Opacity,
              lineHeight: 1.5,
            }}
          >
            Mortgage. Investments. Taxes. Benefits. Nobody can do that math in their head.
          </p>
        </div>

        {/* Solution text */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 40,
            right: 40,
            opacity: solutionOpacity,
            transform: `translateY(${interpolate(solutionProgress, [0, 1], [30, 0])}px)`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: FONTS.serif,
              fontSize: 68,
              color: COLORS.textPrimary,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Introducing{' '}
            <span style={{ color: COLORS.accentGreen }}>Pathfinder</span>
          </p>
          <p
            style={{
              fontFamily: FONTS.sans,
              fontSize: 24,
              color: COLORS.textSecondary,
              marginTop: 24,
              opacity: subOpacity,
            }}
          >
            A financial simulation engine for Wealthsimple
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
