import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { COLORS, SCENE_DURATIONS } from './constants';
import { Intro } from './scenes/Intro';
import { AppDemo } from './scenes/AppDemo';
import { ArchScene } from './scenes/ArchScene';
import { Outro } from './scenes/Outro';

// Pre-compute cumulative offsets
const scenes = ['intro', 'appDemo', 'arch', 'outro'] as const;

const offsets: Record<string, number> = {};
let cumulativeOffset = 0;
for (const scene of scenes) {
  offsets[scene] = cumulativeOffset;
  cumulativeOffset += SCENE_DURATIONS[scene];
}

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Sequence from={offsets.intro} durationInFrames={SCENE_DURATIONS.intro}>
        <Intro />
      </Sequence>

      <Sequence from={offsets.appDemo} durationInFrames={SCENE_DURATIONS.appDemo}>
        <AppDemo />
      </Sequence>

      <Sequence from={offsets.arch} durationInFrames={SCENE_DURATIONS.arch}>
        <ArchScene />
      </Sequence>

      <Sequence from={offsets.outro} durationInFrames={SCENE_DURATIONS.outro}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
