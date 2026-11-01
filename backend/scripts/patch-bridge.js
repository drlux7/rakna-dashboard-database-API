const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../node_modules/whatsapp-rust-bridge/package.json');
try {
  if (fs.existsSync(target)) {
    const pkg = JSON.parse(fs.readFileSync(target, 'utf8'));
    pkg.main = './dist/index.js';
    pkg.exports = {
      '.': {
        import: './dist/index.js',
        require: './dist/index.js',
        default: './dist/index.js',
        types: './dist/index.d.ts',
      },
    };
    fs.writeFileSync(target, JSON.stringify(pkg, null, 2), 'utf8');
    console.log('[PATCH] whatsapp-rust-bridge patched successfully');
  }
} catch (e) {
  console.warn('[PATCH] Could not patch whatsapp-rust-bridge:', e.message);
}

