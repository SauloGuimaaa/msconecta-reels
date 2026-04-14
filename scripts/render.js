#!/usr/bin/env node
/**
 * scripts/render.js
 * Renderiza um Reel MSConecta via CLI.
 *
 * Uso:
 *   node scripts/render.js --video="videos/teste.mp4" --title="Título aqui" --offset=0
 *   node scripts/render.js --video="videos/clip.mp4" --title="Gato some misteriosamente" --position=top-left --offset=150
 *
 * Argumentos:
 *   --video      caminho do vídeo dentro de public/ (obrigatório)
 *   --title      título da notícia (obrigatório)
 *   --position   bottom-left | top-left | center  (padrão: bottom-left)
 *   --offset     verticalOffset numérico (padrão: 0)
 */

const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');

// ── Parsear argumentos ───────────────────────────────────────────────────────��
function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--(\w+)=?(.*)$/);
    if (match) args[match[1]] = match[2] || true;
  }
  return args;
}

// ── Gerar slug sem acentos ────────────────────────────────────────────────────
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // remove caracteres especiais
    .trim()
    .replace(/\s+/g, '-')            // espaços → hífens
    .replace(/-+/g, '-')             // hífens duplos → simples
    .slice(0, 80);                   // limitar comprimento
}

// ── Main ──────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv);

if (!args.video || !args.title) {
  console.error('Uso: node scripts/render.js --video="videos/clip.mp4" --title="Título aqui"');
  console.error('Opcionais: --position=bottom-left --offset=0');
  process.exit(1);
}

const videoSrc    = args.video;
const title       = args.title;
const position    = args.position || 'bottom-left';
const offset      = parseInt(args.offset ?? '0', 10);

const slug        = slugify(title);
const timestamp   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outFile     = `out/${slug}_${timestamp}.mp4`;
const outDir      = path.join(__dirname, '..', 'out');

// Garantir que a pasta out/ existe
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, {recursive: true});
}

const props = {videoSrc, title, position, verticalOffset: offset};

// Salvar props em arquivo temporário — necessário no Windows onde o shell
// não suporta aspas simples ao redor de JSON inline no CLI
const tmpDir     = path.join(__dirname, '..', 'tmp');
const propsFile  = path.join(tmpDir, 'render-props.json');
fs.mkdirSync(tmpDir, {recursive: true});
fs.writeFileSync(propsFile, JSON.stringify(props, null, 2), 'utf8');

const command = [
  'npx remotion render ReelMSConecta',
  `"${outFile}"`,
  `--props="tmp/render-props.json"`,
].join(' ');

console.log('\n┌─ MSConecta Render ─────────────────────────────────────────');
console.log(`│  Vídeo:    ${videoSrc}`);
console.log(`│  Título:   ${title}`);
console.log(`│  Posição:  ${position} (offset: ${offset})`);
console.log(`│  Saída:    ${outFile}`);
console.log('├────────────────────────────────────────────────────────────');
console.log(`│  $ ${command}`);
console.log('└────────────────────────────────────────────────────────────\n');

let renderOk = false;
try {
  execSync(command, {stdio: 'inherit', cwd: path.join(__dirname, '..')});
  renderOk = true;
} catch (err) {
  console.error('\n✗ Falha no render:', err.message);
} finally {
  // Limpar arquivo temporário de props (sucesso ou falha)
  try { fs.unlinkSync(propsFile); } catch { /* ignorar */ }
}

if (renderOk) {
  console.log(`\n✓ Reel gerado: ${path.resolve(__dirname, '..', outFile)}\n`);
} else {
  process.exit(1);
}
