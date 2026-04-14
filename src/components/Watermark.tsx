import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';

export const Watermark: React.FC = () => (
  <AbsoluteFill
    style={{
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
    }}
  >
    <img
      src={staticFile('watermark.png')}
      style={{width: 750, opacity: 0.18}}
    />
  </AbsoluteFill>
);
