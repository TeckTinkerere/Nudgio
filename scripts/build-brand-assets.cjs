// Rasterises the SVG master (assets/brand/nudgio-mark.svg) into the PNG sizes
// the web needs. Deliberately a separate step rather than hand-exported art:
// every raster here derives from the one vector, so they cannot drift from it.
//
// Usage: node scripts/build-brand-assets.cjs
const {execFileSync} = require('node:child_process');
const path = require('node:path');
execFileSync('python', [path.join(__dirname, 'build-brand-assets.py')], {stdio: 'inherit'});
