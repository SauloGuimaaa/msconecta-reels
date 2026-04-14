# MSConecta — Remotion Reels Generator

## Objetivo
Gerar automaticamente Reels 9:16 no padrão visual do MSConecta.
O sistema recebe um vídeo de origem + título + posição dos títulos e produz um .mp4 com a identidade aplicada.

---

## Especificações técnicas fixas

```
Resolução:   1080 × 1920 px (9:16 vertical)
FPS:         30
Formato:     MP4 (H.264)
Duração:     duração do vídeo original (sem modificação)
```

---

## Identidade Visual MSConecta

### Paleta
```
Azul primário:    #1a5f8a   → fundo do título personalizado
Azul escuro:      #0d4f7a   → fundo do bloco da marca / hover
Azul logo:        #1a7bc4   → triângulos do ícone
Branco:           #FFFFFF   → todos os textos
Marca d'água:     rgba(255,255,255,0.06)  → watermark sobre vídeo
```

### Tipografia
```
Título personalizado (Bloco 2):  Montserrat Bold (700) — fonte principal dos títulos de notícia
Bloco da marca (Bloco 1):        logo-white.png (imagem) — Barlow Condensed carregado como fallback
Fallback texto:                  Impact, Arial, sans-serif
```

> ⚠️ **Correção aplicada (2026-04):** fonte do título trocada de Barlow Condensed para **Montserrat Bold 700**.

### Assets (sempre usar staticFile())
```
src/assets/logo-triangles.png   → ícone triangular (canto sup. direito)
src/assets/logo-white.png       → logotipo branco sem fundo (bloco de marca)
src/assets/watermark.png        → versão ultra-transparente para overlay
```

---

## Anatomia de um Reel MSConecta

### Camadas (ordem de renderização, de baixo para cima)

```
1. [VÍDEO ORIGINAL]         — ocupa 100% do frame, sem crop
2. [WATERMARK]              → componente <Watermark>
3. [LOGO TRIANGULAR]        → componente <LogoIcon>
4. [BLOCO DE TÍTULOS]       → componente <TitleOverlay> (aparece 0s–4.5s)
```

---

## Componentes

### `<Watermark />`
- **Comportamento:** visível do frame 0 ao último frame
- **Estilo:** logotipo MSConecta centralizado, `opacity: 0.06`, `fontSize: 48px`
- **Posição:** centro absoluto do frame, não interfere com conteúdo
- **Animação:** nenhuma — estático durante todo o vídeo

```tsx
// Exemplo de implementação
export const Watermark: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
    <img src={staticFile('watermark.png')} style={{ width: 400, opacity: 0.06 }} />
  </AbsoluteFill>
);
```

---

### `<LogoIcon />`
- **Comportamento:** visível do frame 0 ao último frame
- **Posição:** `top: 36px, right: 36px` (fixo, nunca muda)
- **Tamanho:** `80 × 80 px`
- **Animação:** `interpolate(frame, [0, 9], [0, 1])` → fade-in suave nos primeiros 9 frames (0.3s)

```tsx
export const LogoIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 9], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <img
        src={staticFile('logo-triangles.png')}
        style={{ position: 'absolute', top: 36, right: 36, width: 80, height: 80, opacity }}
      />
    </AbsoluteFill>
  );
};
```

---

### `<TitleOverlay />`

**Props:**
```tsx
interface TitleOverlayProps {
  title: string;               // Título personalizado da notícia
  position: TitlePosition;     // 'bottom-left' | 'top-left' | 'center'
  appearAt?: number;           // frame de entrada (padrão: 0)
  exitAt?: number;             // frame de saída (padrão: fps * 4.5 = 135)
}

type TitlePosition = 'bottom-left' | 'top-left' | 'center';
```

**Comportamento de animação:** estilo "Expor para a direita" (CapCut)
```
Entrada:  slideRight + fadeIn  → translateX -100% → 0  +  opacity 0 → 1  (15 frames, 0.5s)
Saída:    slideLeft  + fadeOut → translateX 0 → -100%  +  opacity 1 → 0  (12 frames, 0.4s)
Delay:    Bloco 1 (logo) entra no frame 0; Bloco 2 (título) entra 5 frames depois
Saída:    ambos os blocos saem simultaneamente
Visível:  do frame `appearAt` até o frame `exitAt`
```

> ⚠️ **Correção aplicada (2026-04):** animação trocada de slideUp/Down (translateY) para slideRight/Left (translateX),
> com delay escalonado de 5 frames entre bloco 1 e bloco 2.

**Estrutura HTML dos blocos:**
```
┌─────────────────────────────────────┐
│  [logo branco MSConecta]            │  ← Bloco 1: fundo #0d4f7a, padding 12px 16px
├─────────────────────────────────────┤
│  [título personalizado da notícia]  │  ← Bloco 2: fundo #1a5f8a, padding 10px 16px
└─────────────────────────────────────┘
```

**Posicionamento por valor de `position`:**
```
'bottom-left' → bottom: 80px, left: 0, right: 0     (padrão — mais comum)
'top-left'    → top: 100px, left: 0, right: 0        (quando conteúdo relevante está embaixo)
'center'      → top: 50%, transform: translateY(-50%) (casos especiais)
```

**Implementação:**
```tsx
export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  title,
  position = 'bottom-left',
  appearAt = 0,
  exitAt,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const exit = exitAt ?? Math.floor(fps * 4.5); // 135 frames @ 30fps

  if (frame < appearAt || frame > exit) return null;

  const relFrame = frame - appearAt;
  const exitFrame = exit - appearAt;

  // Bloco 1 (logo) — delay 0
  const b1Enter = interpolate(relFrame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b1Exit  = interpolate(relFrame, [exitFrame - 12, exitFrame], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b1X     = interpolate(b1Enter, [0, 1], [-100, 0]) + interpolate(b1Exit, [0, 1], [0, -100]);

  // Bloco 2 (título) — delay 5 frames
  const b2Enter = interpolate(relFrame - 5, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b2X     = interpolate(b2Enter, [0, 1], [-100, 0]) + interpolate(b1Exit, [0, 1], [0, -100]);

  const posStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    ...(position === 'bottom-left' && { bottom: 80 }),
    ...(position === 'top-left' && { top: 100 }),
    ...(position === 'center' && { top: '50%', marginTop: -40 }),
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={posStyle}>
        {/* Bloco 1: Logo MSConecta — fundo #0d4f7a */}
        <div style={{
          background: '#0d4f7a',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          transform: `translateX(${b1X}%)`,
          opacity: b1Enter * (1 - b1Exit),
        }}>
          <img src={staticFile('logo-white.png')} style={{ height: 28 }} />
        </div>
        {/* Bloco 2: Título personalizado — fundo #1a5f8a — Montserrat Bold 700 */}
        <div style={{
          background: '#1a5f8a',
          padding: '10px 16px',
          transform: `translateX(${b2X}%)`,
          opacity: b2Enter * (1 - b1Exit),
        }}>
          <span style={{
            fontFamily: 'Montserrat, Impact, Arial, sans-serif',
            fontWeight: 700,
            fontSize: 36,
            color: '#FFFFFF',
            lineHeight: 1.2,
          }}>
            {title}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

---

## Composição principal

```tsx
// src/compositions/ReelMSConecta.tsx

interface ReelMSConectaProps {
  videoSrc: string;        // caminho do vídeo (staticFile)
  title: string;           // título da notícia
  position?: TitlePosition; // posição dos blocos (padrão: 'bottom-left')
  titleAppearAt?: number;  // frame de entrada dos títulos (padrão: 0)
  titleExitAt?: number;    // frame de saída (padrão: fps * 4.5)
}

export const ReelMSConecta: React.FC<ReelMSConectaProps> = ({
  videoSrc,
  title,
  position = 'bottom-left',
  titleAppearAt = 0,
  titleExitAt,
}) => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* 1. Vídeo original — full frame */}
      <Video src={staticFile(videoSrc)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

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
      />
    </AbsoluteFill>
  );
};
```

---

## Registro no Root

```tsx
// src/Root.tsx
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelMSConecta"
        component={ReelMSConecta}
        durationInFrames={900}   // override por vídeo
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: 'video.mp4',
          title: 'Título da notícia aqui',
          position: 'bottom-left',
        }}
      />
    </>
  );
};
```

---

## Decisão de posição dos títulos

Regra para o agente decidir automaticamente (ou sugerir ao operador):

```
SE conteúdo principal do vídeo está na parte INFERIOR  → usar 'top-left'
SE conteúdo principal do vídeo está na parte SUPERIOR  → usar 'bottom-left' (padrão)
SE vídeo tem conteúdo central importante               → usar 'top-left' ou 'bottom-left' (evitar 'center')
```

Variável de input para o n8n/automação:
```json
{
  "videoSrc": "video_pitbull.mp4",
  "title": "Pitbull sendo feito de refém",
  "position": "bottom-left"
}
```

---

## Regras de desenvolvimento

1. **Nunca hardcodar assets** — sempre `staticFile('nome.ext')`
2. **Nunca modificar** a posição fixa do `<LogoIcon>` (top: 36, right: 36)
3. **Nunca modificar** as cores da paleta sem aprovação — use as variáveis definidas
4. **Nunca adicionar** novos elementos visuais sem documentar aqui
5. **Sempre testar** com `npx remotion preview` antes de render final
6. **Fonte Barlow Condensed** deve estar em `public/fonts/` e carregada via `@remotion/google-fonts` ou CSS local

---

## Comandos úteis

```bash
# Preview interativo
npx remotion preview

# Render de um reel
npx remotion render ReelMSConecta out/reel_$(date +%Y%m%d).mp4 \
  --props='{"videoSrc":"video.mp4","title":"Título aqui","position":"bottom-left"}'

# Render via JSON props file
npx remotion render ReelMSConecta out/reel.mp4 --props=props.json
```

---

## Estrutura de arquivos

```
msconecta-reels/
├── CLAUDE.md                  ← este arquivo (contexto para o Claude Code)
├── package.json
├── remotion.config.ts
├── public/
│   ├── fonts/
│   │   └── BarlowCondensed-Bold.ttf
│   └── videos/                ← vídeos de entrada
├── src/
│   ├── Root.tsx
│   ├── compositions/
│   │   └── ReelMSConecta.tsx
│   └── components/
│       ├── Watermark.tsx
│       ├── LogoIcon.tsx
│       └── TitleOverlay.tsx
└── assets/
    ├── logo-triangles.png     ← ícone triangular azul
    ├── logo-white.png         ← logotipo branco (para bloco de título)
    └── watermark.png          ← versão ultra-transparente
```