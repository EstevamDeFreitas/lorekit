function bindWindowControls() {
  document.getElementById('win-min')?.addEventListener('click', () => {
    window.electronAPI?.minimize();
  });
  document.getElementById('win-max')?.addEventListener('click', () => {
    window.electronAPI?.toggleMaximize();
  });
  document.getElementById('win-close')?.addEventListener('click', () => {
    window.electronAPI?.close();
  });
  document.getElementById('titlebar')?.addEventListener('dblclick', () => window.electronAPI?.toggleMaximize());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindWindowControls, { once: true });
} else {
  bindWindowControls();
}
