import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../constants';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "The most important design decision" text
  const line1Opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const line1Y = spring({ frame, fps, config: { damping: 15 } });

  // Boundary points
  const points = [
    'Never moves money without confirmation',
    'Flags advisor moments',
    'Enforces balance limits',
    'Knows when NOT to act',
  ];

  // Fade out boundary section
  const boundaryExit = interpolate(frame, [180, 210], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Final tagline
  const taglineOpacity = interpolate(frame, [220, 260], [0, 1], { extrapolateRight: 'clamp' });
  const taglineProgress = spring({
    frame: Math.max(0, frame - 220),
    fps,
    config: { damping: 12, mass: 0.8 },
  });

  // Wealthsimple logo text
  const logoOpacity = interpolate(frame, [270, 300], [0, 1], { extrapolateRight: 'clamp' });

  // Ambient glow pulse
  const glowScale = interpolate(frame, [220, 390], [0.8, 1.2]);

  return (
    <AbsoluteFill style={{ background: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', width: 900, height: 900, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(62,201,122,0.08) 0%, transparent 60%)',
        top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${glowScale})`,
      }} />

      <div style={{ maxWidth: 900, textAlign: 'center', padding: 40, position: 'relative' }}>
        {/* Human/AI Boundary section */}
        <div style={{ opacity: boundaryExit }}>
          <p style={{
            fontFamily: FONTS.serif, fontSize: 44, color: COLORS.textPrimary,
            margin: 0, lineHeight: 1.2, opacity: line1Opacity,
            transform: `translateY(${interpolate(line1Y, [0, 1], [20, 0])}px)`,
          }}>
            Where the AI stops.
          </p>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 20,
            marginTop: 40, flexWrap: 'wrap',
          }}>
            {points.map((point, i) => {
              const delay = 40 + i * 20;
              const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' });
              const progress = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 18 },
              });

              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 20px', borderRadius: 24,
                    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                    opacity,
                    transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
                  }}
                >
                  <p style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textPrimary, margin: 0, fontWeight: 500 }}>
                    {point}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final tagline */}
        <div style={{
          position: 'absolute', top: 0, left: 40, right: 40,
          opacity: taglineOpacity,
          transform: `translateY(${interpolate(taglineProgress, [0, 1], [30, 0])}px)`,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: FONTS.serif, fontSize: 56, color: COLORS.textPrimary,
            margin: 0, lineHeight: 1.2, letterSpacing: -1,
          }}>
            <span style={{ color: COLORS.accentGreen }}>Pathfinder</span>
          </p>
          <p style={{
            fontFamily: FONTS.sans, fontSize: 22, color: COLORS.textSecondary,
            marginTop: 20, lineHeight: 1.5,
          }}>
            The financial digital twin that makes Wealthsimple the only platform where your entire financial life talks to itself.
          </p>

          {/* Logo/brand */}
          <div style={{ marginTop: 60, opacity: logoOpacity }}>
            <p style={{
              fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textTertiary,
              letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, margin: 0,
            }}>
              Built for Wealthsimple
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
