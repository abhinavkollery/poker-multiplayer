// Floating Emoji Reactions System for Party Games Hub
// Optimized 60 FPS hardware-accelerated particle system

class PartyReactions {
  constructor(socket = null) {
    this.socket = socket;
    this.emojis = ['👏', '🔥', '💀', '😂', '🤯', '🎯', '❤️'];
    this.container = null;
    this.maxParticles = 12;
    this.init();
  }

  init() {
    if (this.container || typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'floatingReactionsContainer';
    this.container.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99999;
      overflow: hidden;
    `;
    document.body.appendChild(this.container);

    if (this.socket) {
      this.bindSocket(this.socket);
    }
  }

  bindSocket(socket) {
    this.socket = socket;
    if (!this.socket) return;
    this.socket.off('party:reaction'); // Prevent duplicate listener
    this.socket.on('party:reaction', ({ emoji, senderName }) => {
      this.spawnReaction(emoji, senderName);
      if (window.sounds && typeof window.sounds.click === 'function') {
        window.sounds.click();
      }
    });
  }

  setSocket(socket) {
    this.bindSocket(socket);
  }

  send(emoji) {
    if (this.socket) {
      this.socket.emit('party:reaction', { emoji });
    }
    this.spawnReaction(emoji, 'You');
    if (window.sounds && typeof window.sounds.click === 'function') {
      window.sounds.click();
    }
  }

  showParticle(emoji, senderName) {
    this.spawnReaction(emoji, senderName);
  }

  spawnReaction(emoji, senderName) {
    if (!this.container) this.init();
    if (!this.container) return;

    // Prune excess particles to keep DOM light and smooth
    if (this.container.children.length >= this.maxParticles) {
      this.container.removeChild(this.container.firstChild);
    }

    const el = document.createElement('div');
    const startX = 15 + Math.random() * 70; // 15% to 85% screen width
    const drift = (Math.random() - 0.5) * 50;

    el.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: ${startX}vw;
      font-size: ${26 + Math.random() * 12}px;
      user-select: none;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 2s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 2s ease;
      transform: translate3d(0, 0, 0) scale(0.6);
      opacity: 1;
      will-change: transform, opacity;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
    `;

    el.innerHTML = `
      <span>${emoji}</span>
      ${senderName && senderName !== 'You' ? `<span style="font-size: 10px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 6px; margin-top: 2px;">${senderName}</span>` : ''}
    `;

    this.container.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate3d(${drift}px, -80vh, 0) scale(1.15)`;
      el.style.opacity = '0';
    });

    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 2100);
  }

  renderBar(targetContainerId = null) {
    if (document.querySelector('.party-reactions-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'party-reactions-bar';
    bar.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(12, 18, 26, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 30px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      z-index: 999;
      user-select: none;
    `;

    this.emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        background: transparent;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        transition: transform 0.15s ease;
        outline: none;
      `;
      btn.onmouseenter = () => btn.style.transform = 'scale(1.3)';
      btn.onmouseleave = () => btn.style.transform = 'scale(1)';
      btn.onclick = () => this.send(emoji);
      bar.appendChild(btn);
    });

    // Sound mute toggle button
    const muteBtn = document.createElement('button');
    const updateMuteIcon = () => {
      muteBtn.textContent = window.sounds && window.sounds.muted ? '🔇' : '🔊';
    };
    updateMuteIcon();
    muteBtn.style.cssText = `
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      font-size: 14px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 12px;
      color: #fff;
      margin-left: 4px;
    `;
    muteBtn.onclick = () => {
      if (window.sounds) {
        window.sounds.toggleMute();
        updateMuteIcon();
      }
    };
    bar.appendChild(muteBtn);

    document.body.appendChild(bar);
  }
}

// Global instances and exports
const defaultReactions = new PartyReactions();
window.PartyReactions = PartyReactions;
window.Reactions = defaultReactions;
