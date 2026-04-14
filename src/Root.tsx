import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {loadFont as loadBarlow} from '@remotion/google-fonts/BarlowCondensed';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import {getVideoMetadata} from '@remotion/media-utils';
import {ReelMSConecta, ReelMSConectaProps} from './compositions/ReelMSConecta';

// Barlow Condensed — bloco da marca (fallback / uso futuro em texto)
loadBarlow('normal', {weights: ['700']});

// Montserrat Bold — fonte do título personalizado (Bloco 2)
loadMontserrat('normal', {weights: ['700']});

const FPS = 30;

// calculateMetadata: lê duração real do vídeo e define durationInFrames automaticamente
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const calcMetadata: CalculateMetadataFunction<any> = async ({props}) => {
  const {videoSrc} = props as ReelMSConectaProps;
  const meta = await getVideoMetadata(staticFile(videoSrc));
  return {
    fps: FPS,
    durationInFrames: Math.ceil(meta.durationInSeconds * FPS),
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelMSConecta"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component={ReelMSConecta as React.ComponentType<any>}
        calculateMetadata={calcMetadata}
        durationInFrames={900} // fallback; sobrescrito por calculateMetadata em runtime
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: 'videos/teste.mp4',
          title: 'Cadelinha ouve voz da tutora e volta sozinha pra casa em cena que encanta a internet',
          position: 'bottom-left',
          // Posições pré-definidas (verticalOffset):
          // 0   → padrão (conteúdo na parte inferior do vídeo)
          // 150 → conteúdo no centro-inferior
          // 300 → conteúdo no centro
          // -150 → conteúdo bem embaixo
          verticalOffset: 0,
        } as ReelMSConectaProps}
      />
    </>
  );
};
