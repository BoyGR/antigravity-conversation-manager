const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mediaDir = path.join(rootDir, 'media');
const tmpSvg = path.join(mediaDir, 'uF101-antigravity.svg');

// Copy SVG with unicode prefix uF101 so svgicons2svgfont assigns \uF101
fs.copyFileSync(path.join(mediaDir, 'antigravity.svg'), tmpSvg);

const fontSvg = path.join(mediaDir, 'antigravity-font.svg');
const fontTtf = path.join(mediaDir, 'antigravity-font.ttf');
const fontWoff = path.join(mediaDir, 'antigravity.woff');

try {
  console.log('Generating SVG font from antigravity.svg...');
  execSync(`npx --yes svgicons2svgfont --fontName antigravity --height 1000 --normalize --centerHorizontally -o "${fontSvg}" "${tmpSvg}"`, { stdio: 'inherit' });

  console.log('Generating TTF...');
  execSync(`npx --yes svg2ttf "${fontSvg}" "${fontTtf}"`, { stdio: 'inherit' });

  console.log('Generating WOFF...');
  execSync(`npx --yes ttf2woff "${fontTtf}" "${fontWoff}"`, { stdio: 'inherit' });

  console.log('Font generated successfully! WOFF size:', fs.statSync(fontWoff).size);
} catch (err) {
  console.error('Error generating font:', err);
  process.exit(1);
} finally {
  if (fs.existsSync(tmpSvg)) fs.unlinkSync(tmpSvg);
  if (fs.existsSync(fontSvg)) fs.unlinkSync(fontSvg);
  if (fs.existsSync(fontTtf)) fs.unlinkSync(fontTtf);
}
