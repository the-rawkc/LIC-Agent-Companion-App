const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// High-end, prestigious vector logo for LIC Agent Companion
const svgContent = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#142c4d" />
      <stop offset="55%" stop-color="#0a192f" />
      <stop offset="100%" stop-color="#040b17" />
    </radialGradient>

    <!-- 24K Polished Gold Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffbeb" />
      <stop offset="25%" stop-color="#fde047" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="75%" stop-color="#d97706" />
      <stop offset="100%" stop-color="#78350f" />
    </linearGradient>

    <!-- Warm Gold Accent -->
    <linearGradient id="warmGold" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="60%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#fffbeb" />
    </linearGradient>

    <!-- Flame Gradients -->
    <linearGradient id="flameOuter" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#dc2626" />
      <stop offset="35%" stop-color="#ea580c" />
      <stop offset="70%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fde047" />
    </linearGradient>

    <linearGradient id="flameCore" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#f97316" />
      <stop offset="50%" stop-color="#fef08a" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>

    <!-- Celestial Radiant Glow -->
    <radialGradient id="sunGlow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.32" />
      <stop offset="40%" stop-color="#0284c7" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#0a192f" stop-opacity="0" />
    </radialGradient>

    <!-- Drop Shadow Filter -->
    <filter id="shieldShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6" />
    </filter>

    <filter id="flameGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="glow" />
      <feComposite in="SourceGraphic" in2="glow" operator="over" />
    </filter>
  </defs>

  <!-- Full-Bleed Squircle Canvas (Safe for iOS rounded corners & Android maskable) -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Outer Beveled Gold Rim -->
  <rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="url(#goldGrad)" stroke-width="8" stroke-opacity="0.85" />
  <rect x="22" y="22" width="468" height="468" rx="92" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="0.3" stroke-dasharray="8 6" />

  <!-- Ambient Radiant Energy Core -->
  <circle cx="256" cy="235" r="175" fill="url(#sunGlow)" />

  <!-- Protective Heraldic Outer Crest -->
  <g filter="url(#shieldShadow)">
    <path d="M256 70 C340 70, 396 106, 396 195 C396 308, 268 402, 256 414 C244 402, 116 308, 116 195 C116 106, 172 70, 256 70 Z" 
          fill="#061324" fill-opacity="0.7" stroke="url(#goldGrad)" stroke-width="10" stroke-linejoin="round" />
  </g>

  <!-- Inner Sacred Arch -->
  <path d="M256 96 C322 96, 368 126, 368 196 C368 286, 264 366, 256 376 C248 366, 144 286, 144 196 C144 126, 190 96, 256 96 Z" 
        fill="none" stroke="url(#warmGold)" stroke-width="2.5" stroke-dasharray="5 5" stroke-opacity="0.5" />

  <!-- Luminous Aura around Flame -->
  <circle cx="256" cy="195" r="58" fill="#fbbf24" fill-opacity="0.18" filter="url(#flameGlow)" />

  <!-- Eternal Jyoti / Flame of Security & Trust -->
  <g filter="url(#flameGlow)">
    <!-- Outer Flame -->
    <path d="M256 122 C274 160, 298 192, 298 226 C298 254, 279 274, 256 274 C233 274, 214 254, 214 226 C214 192, 238 160, 256 122 Z" 
          fill="url(#flameOuter)" />

    <!-- Core Inner Flame -->
    <path d="M256 158 C267 186, 280 206, 280 228 C280 244, 269 258, 256 258 C243 258, 232 244, 232 228 C232 206, 245 186, 256 158 Z" 
          fill="url(#flameCore)" />

    <!-- Pure Diamond Core Spark -->
    <ellipse cx="256" cy="232" rx="6" ry="12" fill="#ffffff" />
  </g>

  <!-- The Revered Protective Hands (Yogakshemam Vahamyaham) -->
  <g filter="url(#shieldShadow)">
    <!-- Main Hand Silhouettes (Pearl White with Gold Sheen) -->
    <path d="M164 278 C176 226, 222 206, 256 206 C290 206, 336 226, 348 278 C358 322, 312 352, 256 360 C200 352, 154 322, 164 278 Z" 
          fill="#ffffff" />

    <!-- Palm Shadow & Creases -->
    <path d="M196 294 C214 262, 238 248, 256 248 C274 248, 298 262, 316 294" 
          fill="none" stroke="#0e243d" stroke-width="7" stroke-linecap="round" />

    <!-- Left Thumb Contour -->
    <path d="M188 270 C202 248, 224 238, 240 238" 
          fill="none" stroke="url(#goldGrad)" stroke-width="3" stroke-linecap="round" />

    <!-- Right Thumb Contour -->
    <path d="M324 270 C310 248, 288 238, 272 238" 
          fill="none" stroke="url(#goldGrad)" stroke-width="3" stroke-linecap="round" />

    <!-- Gold Wrist Cuff / Foundation -->
    <path d="M220 348 C238 356, 274 356, 292 348 C294 358, 286 368, 256 368 C226 368, 218 358, 220 348 Z" 
          fill="url(#goldGrad)" />
  </g>

  <!-- Twin Golden Sparkles of Trust & Prosperity -->
  <!-- Left Star -->
  <g transform="translate(176, 154) scale(0.95)">
    <polygon points="0,-16 4,-4 16,0 4,4 0,16 -4,4 -16,0 -4,-4" fill="url(#warmGold)" />
    <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
  </g>

  <!-- Right Star -->
  <g transform="translate(336, 154) scale(0.95)">
    <polygon points="0,-16 4,-4 16,0 4,4 0,16 -4,4 -16,0 -4,-4" fill="url(#warmGold)" />
    <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
  </g>

  <!-- Bottom Brand Plaque "LIC" -->
  <rect x="204" y="426" width="104" height="28" rx="8" fill="#040d1a" stroke="url(#goldGrad)" stroke-width="2.5" />
  <text x="256" y="446" fill="#fde047" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" letter-spacing="4" text-anchor="middle">LIC</text>
</svg>`;

async function buildIcons() {
  console.log('Generating high-resolution PWA & native app icons...');

  // 1. Write SVGs
  const publicDir = path.resolve(__dirname, '../public');
  const iconsDir = path.resolve(publicDir, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const logoSvgPath = path.resolve(iconsDir, 'logo.svg');
  const faviconSvgPath = path.resolve(publicDir, 'favicon.svg');
  fs.writeFileSync(logoSvgPath, svgContent);
  fs.writeFileSync(faviconSvgPath, svgContent);
  console.log('✓ Written logo.svg & favicon.svg');

  // 2. Generate 512x512 PNG
  const svgBuffer = Buffer.from(svgContent);
  const icon512Path = path.resolve(iconsDir, 'icon-512x512.png');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(icon512Path);
  console.log('✓ Generated icon-512x512.png (512x512)');

  // 3. Generate 192x192 PNG
  const icon192Path = path.resolve(iconsDir, 'icon-192x192.png');
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(icon192Path);
  console.log('✓ Generated icon-192x192.png (192x192)');

  // 4. Generate 180x180 Apple Touch Icon
  const appleTouchPath = path.resolve(publicDir, 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(appleTouchPath);
  console.log('✓ Generated apple-touch-icon.png (180x180)');

  // 5. Generate Multi-Size ICO File (32x32 & 48x48)
  const ico32Buffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const ico48Buffer = await sharp(svgBuffer).resize(48, 48).png().toBuffer();

  // Simple, valid multi-image ICO binary pack
  // ICO Header: 2 bytes reserved (0), 2 bytes type (1 = ICO), 2 bytes count (2 images)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(2, 4);

  const dirOffset = 6 + 16 * 2; // header (6) + 2 entries of 16 bytes = 38
  
  // Entry 1: 32x32
  const entry1 = Buffer.alloc(16);
  entry1.writeUInt8(32, 0); // width
  entry1.writeUInt8(32, 1); // height
  entry1.writeUInt8(0, 2);  // color palette (0 for truecolor)
  entry1.writeUInt8(0, 3);  // reserved
  entry1.writeUInt16LE(1, 4); // color planes
  entry1.writeUInt16LE(32, 6); // bpp
  entry1.writeUInt32LE(ico32Buffer.length, 8); // image size
  entry1.writeUInt32LE(dirOffset, 12); // offset

  // Entry 2: 48x48
  const entry2 = Buffer.alloc(16);
  entry2.writeUInt8(48, 0); // width
  entry2.writeUInt8(48, 1); // height
  entry2.writeUInt8(0, 2);  // color palette
  entry2.writeUInt8(0, 3);  // reserved
  entry2.writeUInt16LE(1, 4); // color planes
  entry2.writeUInt16LE(32, 6); // bpp
  entry2.writeUInt32LE(ico48Buffer.length, 8); // image size
  entry2.writeUInt32LE(dirOffset + ico32Buffer.length, 12); // offset

  const icoBuffer = Buffer.concat([header, entry1, entry2, ico32Buffer, ico48Buffer]);
  const faviconIcoPath = path.resolve(publicDir, 'favicon.ico');
  fs.writeFileSync(faviconIcoPath, icoBuffer);
  console.log('✓ Generated favicon.ico (packed 32x32 & 48x48)');

  console.log('All icons built successfully!');
}

buildIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
