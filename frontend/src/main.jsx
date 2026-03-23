import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration);
      })
      .catch((error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      });
  });
}

// Handle install prompt
let deferredPrompt;
const installPromptDiv = document.createElement('div');
installPromptDiv.id = 'pwa-install-prompt';
installPromptDiv.style.cssText = `
  position: fixed;
  bottom: 20px;
  left: 20px;
  right: 20px;
  background: linear-gradient(135deg, #0f6f62 0%, #12927f 100%);
  color: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: none;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

installPromptDiv.innerHTML = `
  <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
    <div style="flex: 1;">
      <strong style="font-size: 16px; display: block; margin-bottom: 4px;">Install SSC App</strong>
      <span style="font-size: 14px; opacity: 0.9;">Get instant access to cricket scoring</span>
    </div>
    <div style="display: flex; gap: 8px; white-space: nowrap;">
      <button id="pwa-install-btn" style="
        background: white;
        color: #0f6f62;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      ">Install</button>
      <button id="pwa-dismiss-btn" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      ">Later</button>
    </div>
  </div>
`;

document.body.appendChild(installPromptDiv);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installPromptDiv.style.display = 'block';
  console.log('[PWA] Install prompt is available');
});

document.getElementById('pwa-install-btn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);
    deferredPrompt = null;
    installPromptDiv.style.display = 'none';
  }
});

document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
  deferredPrompt = null;
  installPromptDiv.style.display = 'none';
});

// Hide install prompt if app is already installed
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully');
  installPromptDiv.style.display = 'none';
  deferredPrompt = null;
});
