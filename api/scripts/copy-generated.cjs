// Copies the generated Prisma client into the build output (tsc does not emit the client's .js/.wasm files).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'generated');
const dest = path.join(__dirname, '..', 'dist', 'src', 'generated');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied Prisma client to ${path.relative(process.cwd(), dest)}`);
