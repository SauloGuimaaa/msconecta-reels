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

  const prompt = `Você é um diretor de arte analisando um frame de vídeo vertical 9:16 (1080×1920px).

## Contexto

Os blocos de título MSConecta SEMPRE ficam o mais abaixo possível ("bottom-left"), partindo de ~80px do rodapé e subindo ~300–500px. Esta é a posição padrão e ideal — NÃO deve ser alterada sem motivo.

O texto original do vídeo (legendas, nome do criador, créditos) normalmente fica ACIMA dos blocos MSConecta, então coexistem sem conflito.

O único parâmetro que você controla é o \`verticalOffset\`: sobe os blocos a partir do rodapé. O valor padrão é 0 e deve ser mantido na maioria dos casos.

## Sua tarefa

Verifique se há texto sobreposto do vídeo original nos ÚLTIMOS 400px do frame (região do rodapé). Ignore qualquer texto acima da metade da tela — ele não conflita com os blocos.

## Regras para calcular o verticalOffset

- Sem texto nos últimos 400px → offset 0 (padrão, mais comum)
- Texto acima da metade da tela (acima dos 960px inferiores) → offset 0, sem conflito
- Texto nos últimos 400px MAS acima de onde os blocos terminam (~500px do rodapé) → offset 0, blocos ficam abaixo do texto naturalmente
- Texto nos últimos 400px que se sobrepõe diretamente à região dos blocos → offset mínimo necessário para separar (normalmente 50–80, raramente acima de 150)

Offset acima de 150 só se justifica se o texto original cobrir mais de 400px a partir do rodapé (situação rara).

## Resposta

Responda APENAS com JSON válido, sem markdown, sem bloco de código, sem explicação fora do JSON:

{
  "position": "bottom-left",
  "verticalOffset": número entre 0 e 400,
  "reasoning": "explicação concisa: o que foi encontrado nos últimos 400px e por que esse offset",
  "occupiedRegions": ["texto/elementos encontrados nos últimos 400px do frame, ou vazio se limpo"]
}`;

  console.error('[analyze] Enviando frame para Claude...');

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
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
  // Usa uma extração balanceada de chaves para suportar arrays e objetos aninhados
  const firstBrace = rawText.indexOf('{');
  if (firstBrace === -1) {
    console.error('[analyze] Resposta inesperada do Claude:', rawText);
    process.exit(1);
  }
  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < rawText.length; i++) {
    if (rawText[i] === '{') depth++;
    else if (rawText[i] === '}') {
      depth--;
      if (depth === 0) { lastBrace = i; break; }
    }
  }
  if (lastBrace === -1) {
    console.error('[analyze] JSON incompleto na resposta do Claude:', rawText);
    process.exit(1);
  }

  let result;
  try {
    result = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
  } catch (e) {
    console.error('[analyze] Falha ao parsear JSON do Claude:', rawText);
    process.exit(1);
  }

  // Validar e normalizar campos
  result.position = 'bottom-left'; // posição sempre fixa
  if (typeof result.verticalOffset !== 'number') result.verticalOffset = 0;
  result.verticalOffset = Math.max(0, Math.min(400, Math.round(result.verticalOffset)));
  if (typeof result.reasoning !== 'string') result.reasoning = '';
  if (!Array.isArray(result.occupiedRegions)) result.occupiedRegions = [];

  // 5. Imprimir JSON no stdout (para ser consumido por outros scripts)
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[analyze] Erro:', err.message);
  process.exit(1);
});
