import React from 'react';

/**
 * Renders the official Rakna sticker artwork with the tag's QR SVG overlaid inside
 * the white QR square.
 * - hasNfc === false -> Vertical yellow sticker (/stickers/sticker-qr-only.jpg)
 * - hasNfc !== false -> Horizontal yellow sticker with NFC icon (/stickers/sticker-nfc-qr.jpg)
 */
export default function StickerTemplateVisual({ tag, maxHeight }) {
  const isQrOnly = tag?.hasNfc === false;
  const templateSrc = isQrOnly
    ? '/stickers/sticker-qr-only.jpg'
    : '/stickers/sticker-nfc-qr.jpg';

  // Exact percentages derived from 585x1024 (QR-only) and 1024x585 (NFC+QR) white box bounds
  const qrBoxStyle = isQrOnly
    ? { left: '13.5%', top: '19.5%', width: '73%', height: '40.5%' }
    : { left: '52%', top: '14%', width: '41.4%', height: '72%' };

  const normalizedSvg = (tag?.qrCodeSvg || '').replace(
    '<svg ',
    '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;" '
  );

  return (
    <div
      className="sticker-template-frame"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: isQrOnly ? (maxHeight ? `calc(${maxHeight} * 585 / 1024)` : '220px') : '100%',
        maxHeight: maxHeight || undefined,
        aspectRatio: isQrOnly ? '585 / 1024' : '1024 / 585',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: '#f4c82b',
        margin: '0 auto',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      }}
    >
      <img
        src={templateSrc}
        alt={isQrOnly ? 'ملصق ركنة QR فقط' : 'ملصق ركنة NFC + QR'}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'fill',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      <div
        className="sticker-template-qr"
        style={{
          position: 'absolute',
          ...qrBoxStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
        dangerouslySetInnerHTML={{ __html: normalizedSvg }}
      />
    </div>
  );
}
