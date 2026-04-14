import React from 'react';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const LogoIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 9], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <img
        src={staticFile('logo-triangles.png')}
        style={{
          position: 'absolute',
          top: 340,
          right: 64,
          width: 260,
          height: 260,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};
