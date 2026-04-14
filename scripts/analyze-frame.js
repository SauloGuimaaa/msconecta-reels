#!/usr/bin/env node
/**
 * scripts/analyze-frame.js
 * Extrai o frame central de um vídeo com ffmpeg e pede ao Claude para
 * identificar onde está o conteúdo visual principal, retornando a
 * posição e o verticalOffset ideais para o TitleOverlay.
 *
 * Uso:
 *   node scripts/analyze-frame.js --video="public/videos/teste.mp4"
 *
 * Saída (JSON impresso no stdout):
 *   {"position": "bottom-left", "verticalOffset": 0}
 *
 * Pré-requisitos:
 *   - ffmpeg instalado e no PATH
 *   - variável de ambiente ANTHROPIC_API_KEY definida
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ── Parsear argumentos ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--(\w+)=?(.*)$/);
    if (match) args[match[1]] = match[2] || true;
  }
  return args;
}

// ── Obter duração do vídeo em segundos via ffprobe ────────────────────────────
function getVideoDuration(videoPath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
      {encoding: 'utf8'},
    );
    return parseFloat(result.trim());
  } catch {
    return null;
  }
}

// ── Extrair frame central do vídeo ────────────────────────────────────────────
function extractMiddleFrame(videoPath, outputPath) {
  const duration = getVideoDuration(videoPath);
  const seekTime = duration != null ? (duration / 2).toFixed(2) : '5';

  const cmd = `ffmpeg -y -ss ${seekTime} -i "${videoPath}" -frames:v 1 -q:v 2 "${outputPath}"`;
  console.error(`[analyze] Extraindo frame em ${seekTime}s: ${cmd}`);
  execSync(cmd, {stdio: ['ignore', 'ignore', 'pipe']});
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (!args.video) {
    console.error('Uso: node scripts/analyze-frame.js --video="public/videos/clip.mp4"');
    process.exit(1);
  }

  const videoPath = path.resolve(args.video);
  if (!fs.existsSync(videoPath)) {
    console.error(`Arquivo não encontrado: ${videoPath}`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Defina a variável de ambiente ANTHROPIC_API_KEY antes de rodar.');
    process.exit(1);
  }

  // Garantir pasta tmp/
  const tmpDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(tmpDir, {recursive: true});
  const framePath = path.join(tmpDir, 'frame.jpg');

  // 1. Extrair frame central
  extractMiddleFrame(videoPath, framePath);
  console.error(`[analyze] Frame salvo em: ${framePath}`);

  // 2. Ler frame como base64
  const imageData = fs.readFileSync(framePath).toString('base64');

  // 3. Enviar para Claude com visão
  const client = new Anthropic.default();

  const prompt = `Neste frame de vídeo vertical 9:16 (1080×1920px), onde está o conteúdo visual principal (rosto, objeto em foco, ação principal)?

Responda APENAS com JSON válido, sem markdown, sem explicação:
{"position": "bottom-left|top-left|center", "verticalOffset": número entre -200 e 400}

Regras para escolher position e verticalOffset:
- Se o conteúdo principal está na metade INFERIOR da tela → use "top-left" com offset 0
- Se o conteúdo principal está na metade SUPERIOR → use "bottom-left" com offset 0
- Se o conteúdo ocupa o centro → use "bottom-left" com offset positivo (150–300) para subir o bloco
- verticalOffset positivo sobe os blocos, negativo desce
- O bloco de título ocupa ~300–500px verticais na parte inferior; evite cobrir o conteúdo principal`;

  console.error('[analyze] Enviando frame para Claude...');

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageData,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';

  // 4. Extrair e validar JSON da resposta
  const jsonMatch = rawText.match(/\{[^}]+\}/);
  if (!jsonMatch) {
    console.error('[analyze] Resposta inesperada do Claude:', rawText);
    process.exit(1);
  }

  const result = JSON.parse(jsonMatch[0]);

  // Validar campos
  const validPositions = ['bottom-left', 'top-left', 'center'];
  if (!validPositions.includes(result.position)) result.position = 'bottom-left';
  if (typeof result.verticalOffset !== 'number') result.verticalOffset = 0;
  result.verticalOffset = Math.max(-200, Math.min(400, result.verticalOffset));

  // 5. Imprimir JSON no stdout (para ser consumido por outros scripts)
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[analyze] Erro:', err.message);
  process.exit(1);
});
