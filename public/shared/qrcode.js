/**
 * Zero-Dependency Pure JavaScript QR Code Generator & Modal UI
 * 100% Client-Side, Works Offline, No External APIs or NPM packages needed.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    const exports = factory();
    root.QRCodeGenerator = exports.QRCodeGenerator;
    root.QRCodeModal = exports.QRCodeModal;
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // =========================================================================
  // Core QR Code Engine (Model 2, Byte Mode, Reed-Solomon Error Correction)
  // =========================================================================

  function QR8bitByte(data) {
    this.mode = 4; // 8-bit byte mode
    this.data = data;
  }
  QR8bitByte.prototype = {
    getLength: function () { return this.data.length; },
    write: function (buffer) {
      for (let i = 0; i < this.data.length; i++) {
        buffer.put(this.data.charCodeAt(i), 8);
      }
    }
  };

  const QRMath = {
    glog: function (n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function (n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num, shift) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (let i = num.length - offset; i < this.num.length; i++) this.num[i] = 0;
  }
  QRPolynomial.prototype = {
    get: function (index) { return this.num[index]; },
    getLength: function () { return this.num.length; },
    multiply: function (e) {
      const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function (e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  const QRRSBlock = {
    RS_BLOCK_TABLE: [
      // 1: L, M, Q, H
      [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
      // 2
      [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
      // 3
      [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
      // 4
      [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
      // 5
      [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
      // 7
      [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
    ],
    getRSBlocks: function (typeNumber, errorCorrectionLevel) {
      const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (rsBlock === undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber);
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i++) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j++) {
          list.push({ totalCount: totalCount, dataCount: dataCount });
        }
      }
      return list;
    },
    getRsBlockTable: function (typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case 1: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0]; // L
        case 0: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1]; // M
        case 3: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2]; // Q
        case 2: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3]; // H
        default: return undefined;
      }
    }
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function (index) {
      const bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
    },
    put: function (num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    },
    putBit: function (bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  const QRUtil = {
    PATTERN_POSITION_TABLE: [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
    ],
    getPatternPosition: function (typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1] || [];
    },
    getMask: function (maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 === 0;
        case 1: return i % 2 === 0;
        case 2: return j % 3 === 0;
        case 3: return (i + j) % 3 === 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5: return (i * j) % 2 + (i * j) % 3 === 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 === 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 === 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getErrorPolynomial: function (errorCorrectionLength) {
      let a = new QRPolynomial([1], 0);
      for (let i = 0; i < errorCorrectionLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },
    getLostPoint: function (qrCode) {
      const moduleCount = qrCode.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r === 0 && c === 0) continue;
              if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    },
    getBCHDigit: function (data) {
      let digit = 0;
      while (data !== 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    }
  };

  function QRCodeModel(typeNumber, errorCorrectionLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function (data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function (row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function () { return this.moduleCount; },
    make: function () {
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function (test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount).fill(null);
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.dataCache === null) {
        this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function (row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    getBestMaskPattern: function () {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    setupTimingPattern: function () {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) continue;
        this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) continue;
        this.modules[6][c] = (c % 2 === 0);
      }
    },
    setupPositionAdjustPattern: function () {
      const pos = QRUtil.getPatternPosition(this.typeNumber);
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeInfo: function (test, maskPattern) {
      const data = (this.errorCorrectionLevel << 3) | maskPattern;
      let bits = data << 10;
      while (QRUtil.getBCHDigit(bits) - QRUtil.getBCHDigit(1335) >= 0) {
        bits ^= (1335 << (QRUtil.getBCHDigit(bits) - QRUtil.getBCHDigit(1335)));
      }
      const typeInfo = ((data << 10) | bits) ^ 21522;
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((typeInfo >> i) & 1) === 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;

        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = !test;
    },
    mapData: function (data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              }
              const mask = QRUtil.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
  };

  QRCodeModel.createData = function (typeNumber, errorCorrectionLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
    const buffer = new QRBitBuffer();
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), 8);
      data.write(buffer);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) {
      totalDataCount += rsBlocks[i].dataCount;
    }
    if (buffer.length + 4 <= totalDataCount * 8) {
      buffer.put(0, 4);
    }
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }
    return QRCodeModel.createBytes(buffer, rsBlocks);
  };

  QRCodeModel.createBytes = function (buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);

    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      }
      offset += dcCount;

      const rsPoly = QRUtil.getErrorPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
    }

    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };

  // Capacities for ECC Level L (1)
  const CAPACITIES_L = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

  function autoDetectTypeNumber(length) {
    for (let t = 1; t < CAPACITIES_L.length; t++) {
      if (length <= CAPACITIES_L[t]) return t;
    }
    return 10;
  }

  function generateQRCode(text) {
    const cleanText = String(text || '');
    const typeNumber = autoDetectTypeNumber(cleanText.length);
    const qr = new QRCodeModel(typeNumber, 1); // Level L for maximal byte capacity
    qr.addData(cleanText);
    qr.make();
    return qr;
  }

  function createSVG(text, options = {}) {
    const size = options.size || 220;
    const margin = options.margin !== undefined ? options.margin : 2;
    const qr = generateQRCode(text);
    const count = qr.getModuleCount();
    const totalSize = count + margin * 2;

    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          const x = c + margin;
          const y = r + margin;
          path += `M${x},${y}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" shape-rendering="crispEdges" style="display:block; max-width:100%; height:auto;">
      <rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/>
      <path d="${path.trim()}" fill="#000000"/>
    </svg>`;
  }

  function renderToCanvas(canvas, text, options = {}) {
    if (!canvas) return;
    const size = options.size || 220;
    const margin = options.margin !== undefined ? options.margin : 2;
    const qr = generateQRCode(text);
    const count = qr.getModuleCount();
    const totalSize = count + margin * 2;

    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const cellSize = size / totalSize;
    ctx.fillStyle = '#000000';

    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          const x = Math.round((c + margin) * cellSize);
          const y = Math.round((r + margin) * cellSize);
          const w = Math.ceil(cellSize);
          const h = Math.ceil(cellSize);
          ctx.fillRect(x, y, w, h);
        }
      }
    }
  }

  const QRCodeGenerator = {
    generateSVG: createSVG,
    createSVG: createSVG,
    toCanvas: renderToCanvas,
    render: function (container, text, options) {
      const el = typeof container === 'string' ? document.getElementById(container) : container;
      if (el) {
        el.innerHTML = createSVG(text, options);
      }
    }
  };

  // =========================================================================
  // QRCodeModal: Interactive, high-contrast modal dialog
  // =========================================================================

  const QRCodeModal = {
    modalId: 'partyQRCodeModal',

    injectStyles: function () {
      if (document.getElementById('qrCodeModalStyles')) return;
      const style = document.createElement('style');
      style.id = 'qrCodeModalStyles';
      style.textContent = `
        .qr-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 15, 25, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          animation: qrFadeIn 0.2s ease-out;
        }
        @keyframes qrFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .qr-modal-card {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.2);
          max-width: 360px;
          width: 100%;
          padding: 24px;
          text-align: center;
          position: relative;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-sizing: border-box;
        }
        .qr-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          transition: all 0.15s;
        }
        .qr-modal-close:hover {
          background: rgba(239, 68, 68, 0.3);
          color: #f87171;
          transform: scale(1.1);
        }
        .qr-modal-title {
          font-size: 1.25rem;
          font-weight: 800;
          margin: 0 0 4px 0;
          color: #ffffff;
        }
        .qr-modal-subtitle {
          font-size: 0.85rem;
          color: #94a3b8;
          margin: 0 0 16px 0;
        }
        .qr-code-box {
          background: #ffffff;
          padding: 12px;
          border-radius: 14px;
          display: inline-block;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          margin-bottom: 16px;
        }
        .qr-room-badge {
          background: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.4);
          color: #38bdf8;
          font-weight: 800;
          font-size: 1.2rem;
          letter-spacing: 3px;
          padding: 8px 16px;
          border-radius: 10px;
          display: inline-block;
          margin-bottom: 16px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .qr-room-badge:hover {
          transform: scale(1.03);
        }
        .qr-copy-row {
          display: flex;
          gap: 8px;
        }
        .qr-url-input {
          flex: 1;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          color: #cbd5e1;
          font-size: 0.85rem;
          font-family: monospace;
          outline: none;
        }
        .qr-copy-btn {
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          color: #0f172a;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .qr-copy-btn:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
      `;
      document.head.appendChild(style);
    },

    getInviteUrl: function (roomId, gameType) {
      const cleanRoom = String(roomId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : '') || 'ROOM').trim().toUpperCase();
      const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
      let url = `${origin}/?join=${encodeURIComponent(cleanRoom)}`;
      if (gameType && gameType !== 'party') {
        url += `&game=${encodeURIComponent(gameType)}`;
      }
      if (typeof window !== 'undefined') {
        const backend = (window.getPartyBackendUrl && window.getPartyBackendUrl()) || localStorage.getItem('party_server_url');
        if (backend) {
          url += `&server=${encodeURIComponent(backend)}`;
        }
      }
      return url;
    },

    sanitizeUrl: function (rawUrl, roomId, gameType) {
      if (!rawUrl || (typeof window !== 'undefined' && rawUrl === window.location.href)) {
        return this.getInviteUrl(roomId, gameType);
      }
      try {
        const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : 'http://localhost:3000';
        const parsed = new URL(rawUrl, origin);
        // Stripping 'name' parameter prevents player session hijack and duplicate name collisions
        parsed.searchParams.delete('name');
        return parsed.toString();
      } catch (e) {
        return String(rawUrl)
          .replace(/([?&])name=[^&#]*/gi, '$1')
          .replace(/\?&/, '?')
          .replace(/[?&]$/, '');
      }
    },

    show: function (targetUrl, roomId, gameType) {
      this.injectStyles();
      this.hide(); // Remove existing modal if any

      const cleanRoom = (roomId || (new URLSearchParams(window.location.search).get('room') || 'ROOM')).toUpperCase();
      const url = this.sanitizeUrl(targetUrl, cleanRoom, gameType);

      const overlay = document.createElement('div');
      overlay.id = this.modalId;
      overlay.className = 'qr-modal-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) QRCodeModal.hide();
      };

      const svgHtml = QRCodeGenerator.createSVG(url, { size: 200, margin: 2 });

      overlay.innerHTML = `
        <div class="qr-modal-card" role="dialog" aria-modal="true">
          <button class="qr-modal-close" onclick="window.QRCodeModal.hide()" title="Close">✕</button>
          <h2 class="qr-modal-title">📱 Scan to Join Team</h2>
          <p class="qr-modal-subtitle">Point your phone camera to join this party room with your own player name</p>
          
          <div class="qr-code-box">
            ${svgHtml}
          </div>

          <div>
            <div class="qr-room-badge" onclick="window.QRCodeModal.copyRoomCode('${cleanRoom}')" title="Click to copy room code">
              CODE: ${cleanRoom}
            </div>
          </div>

          <div class="qr-copy-row">
            <input type="text" class="qr-url-input" id="qrModalUrlInput" value="${url}" readonly onclick="this.select()">
            <button class="qr-copy-btn" id="qrModalCopyBtn" onclick="window.QRCodeModal.copyLink()">Copy Link</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Play soft sound if sound engine is present
      if (window.sounds && typeof window.sounds.play === 'function') {
        window.sounds.play('cardFlip');
      }

      // Close on Escape key
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          QRCodeModal.hide();
          window.removeEventListener('keydown', keyHandler);
        }
      };
      window.addEventListener('keydown', keyHandler);
    },

    hide: function () {
      const existing = document.getElementById(this.modalId);
      if (existing) existing.remove();
    },

    copyLink: function () {
      const input = document.getElementById('qrModalUrlInput');
      const btn = document.getElementById('qrModalCopyBtn');
      if (input) {
        input.select();
        navigator.clipboard.writeText(input.value);
        if (btn) {
          btn.textContent = 'Copied! ✓';
          btn.style.background = '#10b981';
          setTimeout(() => {
            btn.textContent = 'Copy Link';
            btn.style.background = '';
          }, 2000);
        }
        if (window.sounds && typeof window.sounds.play === 'function') {
          window.sounds.play('success');
        }
      }
    },

    copyRoomCode: function (code) {
      navigator.clipboard.writeText(code);
      if (window.sounds && typeof window.sounds.play === 'function') {
        window.sounds.play('success');
      }
      alert(`Room code ${code} copied to clipboard!`);
    }
  };

  return {
    QRCodeGenerator,
    QRCodeModal
  };
}));
