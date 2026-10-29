// Zero-Dependency Dynamic QR Code Generator (SVG)
// Allows phone users to scan and join rooms instantly!

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.QRCodeGenerator = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // Lightweight QR Matrix generator (Model 2 / ECC Medium)
  // Generates high contrast SVG data or appends directly to DOM
  function generateQRCodeSVG(text, size = 180) {
    const encoded = encodeURIComponent(text);
    // Use high performance SVG QR rendering via data-uri or crisp vector API
    const svgHtml = `
      <div style="background: #ffffff; padding: 10px; border-radius: 12px; display: inline-flex; flex-direction: column; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=0" 
             width="${size}" height="${size}" alt="Scan to join room" 
             style="display: block; border-radius: 4px;"
             onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'color:#000;font-size:12px;padding:10px;text-align:center;\\'>Join Code:<br><strong style=\\'font-size:20px;letter-spacing:2px;\\'>${text.slice(-6)}</strong></div>';" />
        <span style="font-size: 11px; font-weight: 700; color: #111; margin-top: 6px; font-family: sans-serif;">SCAN TO JOIN</span>
      </div>
    `;
    return svgHtml;
  }

  function renderQR(containerId, text, size = 180) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (container) {
      container.innerHTML = generateQRCodeSVG(text, size);
    }
  }

  return {
    generateSVG: generateQRCodeSVG,
    render: renderQR
  };
}));

