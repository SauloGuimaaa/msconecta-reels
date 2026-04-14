import {Config} from '@remotion/cli/config';

// Formato de saída: MP4 H.264
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// Resolução padrão: 1080×1920 @ 30fps (definida nas Compositions em Root.tsx)
// A configuração de width/height/fps fica no <Composition> em src/Root.tsx
