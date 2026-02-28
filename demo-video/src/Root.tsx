import React from 'react';
import { Composition } from 'remotion';
import { DemoVideo } from './DemoVideo';
import { WIDTH, HEIGHT, FPS, TOTAL_DURATION } from './constants';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
