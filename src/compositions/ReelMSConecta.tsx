import React from 'react';
import {AbsoluteFill, staticFile, Video} from 'remotion';
import {LogoIcon} from '../components/LogoIcon';
import {TitleOverlay, TitlePosition} from '../components/TitleOverlay';
import {Watermark} from '../components/Watermark';

export interface ReelMSConectaProps {
  videoSrc: string;
  title: string;
  position?: TitlePosition;
  titleAppearAt?: number;
  titleExitAt?: number;
  verticalOffset?: number;
}

export const ReelMSConecta: React.FC<ReelMSConectaProps> = ({
  videoSrc,
  title,
  position = 'bottom-left',
  titleAppearAt = 0,
  titleExitAt,
  verticalOffset = 0,
}) => {
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* 1. Vídeo original — full frame */}
      <Video
        src={staticFile(videoSrc)}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />

      {/* 2. Marca d'água centralizada */}
      <Watermark />

      {/* 3. Logo triangular canto superior direito */}
      <LogoIcon />

      {/* 4. Bloco de títulos com animação */}
      <TitleOverlay
        title={title}
        position={position}
        appearAt={titleAppearAt}
        exitAt={titleExitAt}
        verticalOffset={verticalOffset}
      />
    </AbsoluteFill>
  );
};
