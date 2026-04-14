import React from 'react';
import {fitText} from '@remotion/layout-utils';
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type TitlePosition = 'bottom-left' | 'top-left' | 'center';

interface TitleOverlayProps {
  title: string;
  position?: TitlePosition;
  appearAt?: number;
  exitAt?: number;
  verticalOffset?: number;
}

// Largura do container do título em px (deve coincidir com maxWidth do Bloco 2)
const TITLE_WIDTH = 720;

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  title,
  position = 'bottom-left',
  appearAt = 0,
  exitAt,
  verticalOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const exit = exitAt ?? Math.floor(fps * 4.5); // 135 frames @ 30fps

  if (frame < appearAt || frame > exit) return null;

  const relFrame = frame - appearAt;
  const exitFrame = exit - appearAt;

  // ── fitText: fontSize automático baseado no comprimento do título ─────────
  // fitText retorna o fontSize para caber em UMA linha dentro de TITLE_WIDTH.
  // Clampamos entre 40px (mínimo legível) e 72px (máximo desejado).
  const {fontSize: rawFontSize} = fitText({
    text: title,
    withinWidth: TITLE_WIDTH,
    fontFamily: 'Montserrat',
    fontWeight: 700,
  });
  const fontSize = Math.min(72, Math.max(40, rawFontSize));

  // ── Animação "Expor para a direita" ──────────────────────────────────────
  // Bloco 1 (logo) — delay 0
  const b1Enter = interpolate(relFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const b1Exit = interpolate(relFrame, [exitFrame - 12, exitFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const b1X = interpolate(b1Enter, [0, 1], [-100, 0]) + interpolate(b1Exit, [0, 1], [0, -100]);
  const b1Opacity = b1Enter * (1 - b1Exit);

  // Bloco 2 (título) — delay 5 frames
  const b2Enter = interpolate(relFrame - 5, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const b2X = interpolate(b2Enter, [0, 1], [-100, 0]) + interpolate(b1Exit, [0, 1], [0, -100]);
  const b2Opacity = b2Enter * (1 - b1Exit);

  // ── Altura estimada do Bloco 2 para empurrar Bloco 1 para cima ───────────
  // Usa fontSize calculado pelo fitText para estimar linhas com mais precisão
  const approxCharsPerLine = Math.floor(TITLE_WIDTH / (fontSize * 0.58));
  const estimatedLines = Math.ceil(title.length / approxCharsPerLine);
  const block2Height = fontSize * 1.35 * estimatedLines + 40; // lineHeight * lines + padding
  const block1Bottom = 300 + block2Height + 20 + verticalOffset;

  // ── Posições por variante ─────────────────────────────────────────────────
  const b1Pos: React.CSSProperties =
    position === 'top-left'
      ? {top: 160, left: 20}
      : position === 'center'
        ? {top: '40%', left: 20}
        : {bottom: block1Bottom, left: 40}; // bottom-left (padrão)

  const b2Pos: React.CSSProperties =
    position === 'top-left'
      ? {top: 360, left: 0}
      : position === 'center'
        ? {top: '55%', left: 0}
        : {bottom: 300 + verticalOffset, left: 40}; // bottom-left (padrão)

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* Bloco 1: logo-white.png — posicionado de forma independente */}
      <img
        src={staticFile('logo-white.png')}
        style={{
          position: 'absolute',
          ...b1Pos,
          height: 180,
          display: 'block',
          transform: `translateX(${b1X}%)`,
          opacity: b1Opacity,
        }}
      />

      {/* Bloco 2: Título — fontSize calculado automaticamente via fitText */}
      <div
        style={{
          position: 'absolute',
          ...b2Pos,
          background: 'rgba(26, 127, 196, 0.75)',
          padding: '20px 28px',
          maxWidth: TITLE_WIDTH,
          borderRadius: 10,
          transform: `translateX(${b2X}%)`,
          opacity: b2Opacity,
        }}
      >
        <span
          style={{
            fontFamily: 'Montserrat, Impact, Arial, sans-serif',
            fontWeight: 700,
            fontSize,
            color: '#FFFFFF',
            lineHeight: 1.3,
            display: 'block',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {title}
        </span>
      </div>
    </AbsoluteFill>
  );
};
