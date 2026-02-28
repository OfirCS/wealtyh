import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  OffthreadVideo,
  Audio,
  staticFile,
  spring,
} from 'remotion';
import { Cursor, CursorKeyframe } from '../components/Cursor';
import { Caption, CaptionSegment } from '../components/Caption';
import { COLORS } from '../constants';

// ─── Zoom Choreography ───
// Each section defines zoom level and focus point (as % of viewport)
interface ZoomSection {
  startFrame: number;
  endFrame: number;
  zoom: number;
  focusX: number; // 0-1, where 0.5 = center
  focusY: number; // 0-1, where 0.5 = center
}

const ZOOM_SECTIONS: ZoomSection[] = [
  // Home screen — full view
  { startFrame: 0, endFrame: 150, zoom: 1.0, focusX: 0.5, focusY: 0.5 },
  // Zoom to balance area
  { startFrame: 150, endFrame: 180, zoom: 1.4, focusX: 0.5, focusY: 0.3 },
  // Zoom back out
  { startFrame: 180, endFrame: 200, zoom: 1.0, focusX: 0.5, focusY: 0.5 },
  // FAB click — zoom to bottom-right
  { startFrame: 200, endFrame: 240, zoom: 1.3, focusX: 0.7, focusY: 0.8 },
  // Input typing — zoom to bottom half
  { startFrame: 240, endFrame: 600, zoom: 1.4, focusX: 0.5, focusY: 0.65 },
  // Submit — back to center
  { startFrame: 600, endFrame: 660, zoom: 1.0, focusX: 0.5, focusY: 0.5 },
  // Thinking — slight zoom center
  { startFrame: 660, endFrame: 990, zoom: 1.2, focusX: 0.5, focusY: 0.45 },
  // Plan actions — zoom center-left
  { startFrame: 990, endFrame: 1200, zoom: 1.3, focusX: 0.45, focusY: 0.45 },
  // Click action — zoom into first action
  { startFrame: 1200, endFrame: 1260, zoom: 1.5, focusX: 0.5, focusY: 0.35 },
  // Confirmation sheet — zoom bottom half
  { startFrame: 1260, endFrame: 1440, zoom: 1.6, focusX: 0.5, focusY: 0.65 },
  // Impacts tab — center
  { startFrame: 1440, endFrame: 1650, zoom: 1.2, focusX: 0.5, focusY: 0.45 },
  // Cashflow tab — center
  { startFrame: 1650, endFrame: 1860, zoom: 1.2, focusX: 0.5, focusY: 0.5 },
  // Advisor flag — zoom in
  { startFrame: 1860, endFrame: 2040, zoom: 1.5, focusX: 0.5, focusY: 0.65 },
];

function getZoomAt(frame: number, fps: number) {
  // Find current and next section
  let current = ZOOM_SECTIONS[0];
  let next = ZOOM_SECTIONS[0];

  for (let i = 0; i < ZOOM_SECTIONS.length; i++) {
    if (frame >= ZOOM_SECTIONS[i].startFrame) {
      current = ZOOM_SECTIONS[i];
      next = ZOOM_SECTIONS[i + 1] || current;
    }
  }

  // If we're within a section, use its values
  if (frame < current.endFrame) {
    // Smooth transition from previous section
    const prevSection =
      ZOOM_SECTIONS[ZOOM_SECTIONS.indexOf(current) - 1] || current;
    const transitionFrames = 20;
    const transitionProgress =
      frame - current.startFrame < transitionFrames
        ? spring({
            frame: frame - current.startFrame,
            fps,
            config: { damping: 18, mass: 0.6 },
            durationInFrames: transitionFrames,
          })
        : 1;

    return {
      zoom: interpolate(
        transitionProgress,
        [0, 1],
        [prevSection.zoom, current.zoom]
      ),
      focusX: interpolate(
        transitionProgress,
        [0, 1],
        [prevSection.focusX, current.focusX]
      ),
      focusY: interpolate(
        transitionProgress,
        [0, 1],
        [prevSection.focusY, current.focusY]
      ),
    };
  }

  return {
    zoom: current.zoom,
    focusX: current.focusX,
    focusY: current.focusY,
  };
}

// ─── Cursor Keyframes ───
// Positions are in screen-space pixels (1920x1080)
const CURSOR_KEYFRAMES: CursorKeyframe[] = [
  // Idle on home screen
  { frame: 0, x: 960, y: 540, hidden: true },
  // Appear before FAB click
  { frame: 170, x: 1400, y: 900 },
  // Click FAB (bottom-right area of the app card)
  { frame: 200, x: 1200, y: 850, clicking: true },
  // Move to textarea
  { frame: 240, x: 960, y: 700 },
  // Hide during typing
  { frame: 255, x: 960, y: 700, hidden: true },
  // Reappear for submit
  { frame: 590, x: 1150, y: 730 },
  // Click submit button
  { frame: 610, x: 1150, y: 730, clicking: true },
  // Hide during thinking
  { frame: 630, x: 960, y: 540, hidden: true },
  // Reappear for action click
  { frame: 1150, x: 960, y: 400 },
  // Click first action
  { frame: 1200, x: 800, y: 380, clicking: true },
  // Click "Review" / "Create goal" button
  { frame: 1300, x: 960, y: 800, clicking: true },
  // Click "Confirm" button
  { frame: 1370, x: 960, y: 800, clicking: true },
  // Move away after confirm
  { frame: 1410, x: 960, y: 540 },
  // Click impacts tab
  { frame: 1440, x: 870, y: 240, clicking: true },
  // Scroll gesture area
  { frame: 1520, x: 960, y: 600 },
  // Click cashflow tab
  { frame: 1650, x: 960, y: 240, clicking: true },
  // Scroll to advisor
  { frame: 1780, x: 960, y: 600 },
  // Rest on advisor flag
  { frame: 1860, x: 960, y: 650 },
  // Hide at end
  { frame: 2000, x: 960, y: 650, hidden: true },
];

// ─── Caption Segments ───
const CAPTION_SEGMENTS: CaptionSegment[] = [
  {
    text: 'Your Wealthsimple home. Real accounts, real balances.',
    startFrame: 30,
    endFrame: 180,
  },
  {
    text: '$48,150 across 5 accounts.',
    startFrame: 150,
    endFrame: 200,
  },
  {
    text: 'Describe any life event in natural language.',
    startFrame: 280,
    endFrame: 590,
  },
  {
    text: 'Real-time analysis. Live data from Google.',
    startFrame: 690,
    endFrame: 960,
  },
  {
    text: '3 concrete actions. Exact dollar amounts.',
    startFrame: 1020,
    endFrame: 1200,
  },
  {
    text: 'The AI suggests. The human decides. Double-confirm.',
    startFrame: 1260,
    endFrame: 1440,
  },
  {
    text: 'Income -42%, but net worth +$180K over 18 months.',
    startFrame: 1470,
    endFrame: 1640,
  },
  {
    text: 'Cashflow by phase — see the full cascade.',
    startFrame: 1680,
    endFrame: 1850,
  },
  {
    text: 'Knows when to stop. Flags advisor moments.',
    startFrame: 1870,
    endFrame: 2030,
  },
];

// ─── Sound Trigger Frames ───
// Click sounds
const CLICK_FRAMES = [200, 610, 1200, 1300, 1370, 1440, 1650];

// Type sounds — every 3rd frame during typing
const TYPE_START = 260;
const TYPE_END = 590;

// Whoosh sounds — at major transitions
const WHOOSH_FRAMES = [150, 200, 600, 660, 990, 1260, 1440, 1650, 1860];

export const AppDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { zoom, focusX, focusY } = getZoomAt(frame, fps);

  // Calculate transform offset based on zoom and focus
  // When zoom > 1, we need to translate to keep focus point centered
  const tx = -(focusX - 0.5) * 1920 * (zoom - 1);
  const ty = -(focusY - 0.5) * 1080 * (zoom - 1);

  // Fade in at start
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Fade out at end
  const fadeOut = interpolate(frame, [2010, 2040], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ background: COLORS.bg, opacity: fadeIn * fadeOut }}
    >
      {/* Captured video with zoom effects */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${zoom}) translate(${tx / zoom}px, ${ty / zoom}px)`,
          transformOrigin: 'center center',
        }}
      >
        <OffthreadVideo
          src={staticFile('capture.webm')}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Cursor overlay */}
      <Cursor keyframes={CURSOR_KEYFRAMES} />

      {/* Caption bar */}
      <Caption segments={CAPTION_SEGMENTS} />

      {/* Sound effects: clicks (each wrapped in Sequence for proper timing) */}
      {CLICK_FRAMES.map((f) => (
        <Sequence key={`click-${f}`} from={f} durationInFrames={5}>
          <Audio src={staticFile('sounds/click.wav')} volume={0.6} />
        </Sequence>
      ))}

      {/* Sound effects: typing (every 6 frames during typing for fewer audio elements) */}
      {Array.from(
        { length: Math.floor((TYPE_END - TYPE_START) / 6) },
        (_, i) => TYPE_START + i * 6
      ).map((f) => (
        <Sequence key={`type-${f}`} from={f} durationInFrames={5}>
          <Audio src={staticFile('sounds/type.wav')} volume={0.3} />
        </Sequence>
      ))}

      {/* Sound effects: whoosh transitions */}
      {WHOOSH_FRAMES.map((f) => (
        <Sequence key={`whoosh-${f}`} from={f} durationInFrames={15}>
          <Audio src={staticFile('sounds/whoosh.wav')} volume={0.35} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
