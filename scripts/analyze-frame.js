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

  const prompt = `Você é um diretor de arte analisando um frame de vídeo vertical 9:16 (1080×1920px) para posicionar blocos gráficos sobrepostos.

## Sua tarefa

Analise TODAS as regiões do frame e identifique:
1. Texto sobreposto no vídeo original (legendas, títulos do criador, créditos, marcas d'água)
2. Rostos ou pessoas em destaque
3. Objetos ou elementos visuais principais da cena
4. Regiões com fundo limpo e disponíveis para sobreposição

## O que será sobreposto

Os blocos MSConecta ocupam aproximadamente 300–500px de altura e toda a largura (left: 0, right: 0). Eles serão posicionados em:
- "bottom-left" → região inferior do frame (a partir de ~80px do rodapé, subindo)
- "top-left"    → região superior do frame (a partir de ~100px do topo, descendo)
- "center"      → região central (usar apenas se ambas as pontas estiverem livres e o centro também)

O \`verticalOffset\` desloca os blocos adicionalmente: positivo sobe, negativo desce (intervalo: −200 a 400).

## Regra principal

Os blocos de título NUNCA devem sobrepor:
- Texto original do vídeo (legendas, títulos, créditos)
- Rostos em destaque ou expressões faciais importantes
- Elementos visuais centrais da cena

## Exemplos de decisão

- Texto na parte inferior (legenda, rodapé do criador) → "top-left", offset 0
- Texto na parte superior (título do post, cabeçalho) → "bottom-left", offset 0 a 100
- Texto em ambas as partes → analise qual lado tem MENOS conteúdo importante e use esse lado; offset conforme o espaço livre
- Rosto centralizado na parte inferior → "top-left", offset 0
- Rosto na parte superior → "bottom-left", offset 0
- Conteúdo central importante → NUNCA use "center"; escolha top-left ou bottom-left
- Frame com fundo limpo em toda parte inferior → "bottom-left", offset 0

## Resposta

Responda APENAS com JSON válido, sem markdown, sem bloco de código, sem explicação fora do JSON:

{
  "position": "bottom-left | top-left | center",
  "verticalOffset": número entre -200 e 400,
  "reasoning": "explicação concisa de por que escolheu essa posição e offset",
  "occupiedRegions": ["lista das regiões identificadas como ocupadas, ex: 'texto de legenda na parte inferior', 'rosto em destaque no centro'"]
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
  const validPositions = ['bottom-left', 'top-left', 'center'];
  if (!validPositions.includes(result.position)) result.position = 'bottom-left';
  if (typeof result.verticalOffset !== 'number') result.verticalOffset = 0;
  result.verticalOffset = Math.max(-200, Math.min(400, result.verticalOffset));
  if (typeof result.reasoning !== 'string') result.reasoning = '';
  if (!Array.isArray(result.occupiedRegions)) result.occupiedRegions = [];

  // 5. Imprimir JSON no stdout (para ser consumido por outros scripts)
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[analyze] Erro:', err.message);
  process.exit(1);
});
