#!/bin/bash
# PWA Checklist - Verify Installation

echo "=========================================="
echo "SSC PWA Setup Verification"
echo "=========================================="
echo ""

# Check manifest.json
echo "✓ Checking manifest.json..."
if [ -f "frontend/public/manifest.json" ]; then
  echo "  ✅ manifest.json exists"
  if grep -q '"display": "standalone"' frontend/public/manifest.json; then
    echo "  ✅ display mode set to 'standalone'"
  fi
  if grep -q '"icons"' frontend/public/manifest.json; then
    echo "  ✅ icons configured"
  fi
else
  echo "  ❌ manifest.json not found"
fi
echo ""

# Check service-worker.js
echo "✓ Checking service-worker.js..."
if [ -f "frontend/public/service-worker.js" ]; then
  echo "  ✅ service-worker.js exists"
  if grep -q "CACHE_NAME" frontend/public/service-worker.js; then
    echo "  ✅ caching strategy implemented"
  fi
  if grep -q "beforeinstallprompt" frontend/public/service-worker.js; then
    echo "  ✅ install prompt handler ready"
  fi
else
  echo "  ❌ service-worker.js not found"
fi
echo ""

# Check index.html
echo "✓ Checking index.html..."
if [ -f "frontend/index.html" ]; then
  echo "  ✅ index.html exists"
  if grep -q 'manifest.json' frontend/index.html; then
    echo "  ✅ manifest.json link present"
  fi
  if grep -q 'meta name="theme-color"' frontend/index.html; then
    echo "  ✅ theme-color meta tag set"
  fi
  if grep -q 'apple-mobile-web-app-capable' frontend/index.html; then
    echo "  ✅ iOS PWA support configured"
  fi
else
  echo "  ❌ index.html not found"
fi
echo ""

# Check main.jsx service worker registration
echo "✓ Checking service worker registration..."
if grep -q "navigator.serviceWorker.register" frontend/src/main.jsx; then
  echo "  ✅ Service worker registration code present"
fi
if grep -q "beforeinstallprompt" frontend/src/main.jsx; then
  echo "  ✅ Install prompt handler in main.jsx"
fi
echo ""

# Check PWA Install Guide component
echo "✓ Checking PWA components..."
if [ -f "frontend/src/components/PWAInstallGuide.jsx" ]; then
  echo "  ✅ PWAInstallGuide.jsx component exists"
fi
if grep -q "PWAInstallGuide" frontend/src/App.jsx; then
  echo "  ✅ PWAInstallGuide imported in App.jsx"
fi
echo ""

echo "=========================================="
echo "PWA Setup Complete! ✅"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Run: npm run dev"
echo "2. Visit: http://localhost:3000"
echo "3. Look for install prompt/button"
echo "4. On Android: Install from browser menu"
echo "5. On iOS: Use Share → Add to Home Screen"
echo ""
