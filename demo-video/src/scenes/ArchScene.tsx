import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONTS } from '../constants';

const PIPELINE_STEPS = [
  {
    label: 'Router',
    sublabel: 'gemini-2.5-flash-lite',
    description: 'Decides if web search is needed',
    delay: 30,
  },
  {
    label: 'Search',
    sublabel: 'Google Grounding',
    description: 'Pulls live rates, costs, prices',
    delay: 90,
    conditional: true,
  },
  {
    label: 'Generate',
    sublabel: 'gemini-2.5-flash',
    description: 'Produces the full financial plan',
    delay: 150,
  },
];

export const ArchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [390, 420], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Guardrails box
  const guardrailDelay = 220;
  const guardrailProgress = spring({
    frame: Math.max(0, frame - guardrailDelay),
    fps,
    config: { damping: 14 },
  });
  const guardrailOpacity = interpolate(frame, [guardrailDelay, guardrailDelay + 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, justifyContent: 'center', alignItems: 'center', opacity: fadeOut }}>
      <div style={{
        position: 'absolute', width: 1000, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(62,201,122,0.04) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }} />

      <div style={{ opacity: fadeIn, textAlign: 'center' }}>
        {/* Title */}
        <p style={{
          fontFamily: FONTS.serif, fontSize: 48, color: COLORS.textPrimary,
          margin: '0 0 60px', letterSpacing: -1,
        }}>
          Under the Hood
        </p>

        {/* Pipeline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          {PIPELINE_STEPS.map((step, i) => {
            const progress = spring({
              frame: Math.max(0, frame - step.delay),
              fps,
              config: { damping: 16, mass: 0.7 },
            });
            const opacity = interpolate(frame, [step.delay, step.delay + 20], [0, 1], { extrapolateRight: 'clamp' });

            // Arrow between steps
            const arrowDelay = step.delay + 30;
            const arrowOpacity = i < PIPELINE_STEPS.length - 1
              ? interpolate(frame, [arrowDelay, arrowDelay + 15], [0, 1], { extrapolateRight: 'clamp' })
              : 0;

            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    width: 260,
                    padding: '28px 24px',
                    background: COLORS.surface,
                    border: `1px solid ${step.conditional ? COLORS.accentGreen + '44' : COLORS.border}`,
                    borderRadius: 20,
                    opacity,
                    transform: `scale(${interpolate(progress, [0, 1], [0.85, 1])})`,
                    position: 'relative',
                  }}
                >
                  {step.conditional && (
                    <div style={{
                      position: 'absolute', top: -10, right: 16,
                      padding: '2px 10px', borderRadius: 10,
                      background: COLORS.accentGreen + '22',
                      border: `1px solid ${COLORS.accentGreen}44`,
                    }}>
                      <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.accentGreen, fontWeight: 600, letterSpacing: 0.5 }}>
                        CONDITIONAL
                      </span>
                    </div>
                  )}
                  <p style={{ fontFamily: FONTS.serif, fontSize: 24, color: COLORS.textPrimary, margin: 0 }}>
                    {step.label}
                  </p>
                  <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.accentGreen, margin: '6px 0 0', fontWeight: 500 }}>
                    {step.sublabel}
                  </p>
                  <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textSecondary, margin: '10px 0 0', lineHeight: 1.4 }}>
                    {step.description}
                  </p>
                </div>

                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{
                    width: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: arrowOpacity,
                  }}>
                    <svg width="40" height="20" viewBox="0 0 40 20">
                      <path d="M0 10 H30 M25 4 L32 10 L25 16" stroke={COLORS.accentGreen} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Guardrails bar below */}
        <div
          style={{
            marginTop: 40,
            padding: '20px 32px',
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 24,
            opacity: guardrailOpacity,
            transform: `translateY(${interpolate(guardrailProgress, [0, 1], [15, 0])}px)`,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 16,
            background: COLORS.accentRed + '22',
            border: `1px solid ${COLORS.accentRed}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14 }}>{'\u26A0'}</span>
          </div>
          <div>
            <p style={{ fontFamily: FONTS.sans, fontSize: 15, color: COLORS.textPrimary, margin: 0, fontWeight: 600 }}>
              Post-Parse Guardrails
            </p>
            <p style={{ fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textSecondary, margin: '4px 0 0' }}>
              Balance caps {'\u00B7'} Deduplication {'\u00B7'} Action limits {'\u00B7'} Fund dedup
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
