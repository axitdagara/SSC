import React, { useState } from 'react';

export function PWAInstallGuide() {
  const [showGuide, setShowGuide] = useState(false);

  const getInstallInstructions = () => {
    const userAgent = navigator.userAgent;
    
    if (/android/i.test(userAgent)) {
      return {
        os: 'Android',
        steps: [
          'Look for the "Install" popup at the bottom of the screen',
          'Tap "Install" to add SSC to your home screen',
          'Or, tap the menu icon (three dots) → "Install app"',
          'The app will appear as a standalone app on your home screen'
        ]
      };
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      return {
        os: 'iOS',
        steps: [
          'Tap the Share button (square with arrow)',
          'Scroll down and tap "Add to Home Screen"',
          'Enter the app name (or leave as "SSC")',
          'Tap "Add" to confirm',
          'The app will appear on your home screen'
        ]
      };
    } else {
      return {
        os: 'Desktop/Web',
        steps: [
          'Look for the install icon in the address bar (usually on the right)',
          'Click the icon to install the app',
          'Or, use the browser menu → "Install SSC"',
          'The app can be launched from your applications menu'
        ]
      };
    }
  };

  const instructions = getInstallInstructions();

  return (
    <>
      <button
        onClick={() => setShowGuide(!showGuide)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: '#0f6f62',
          color: 'white',
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold'
        }}
        title="PWA Install Guide"
      >
        ?
      </button>

      {showGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#173a36' }}>Install SSC App</h2>
              <button
                onClick={() => setShowGuide(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#305d57',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#476b67', marginBottom: '16px' }}>
              <strong>Platform:</strong> {instructions.os}
            </p>

            <h3 style={{ color: '#0f6f62', marginTop: '0', marginBottom: '12px' }}>How to Install:</h3>
            <ol style={{ color: '#1d4b45', margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
              {instructions.steps.map((step, idx) => (
                <li key={idx} style={{ marginBottom: '8px' }}>
                  {step}
                </li>
              ))}
            </ol>

            <div style={{
              background: '#f4faf8',
              border: '1px solid #d0e8e3',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '16px',
              color: '#305d57',
              fontSize: '13px',
            }}>
              <strong>Benefits of installing:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px' }}>
                <li>Access app from home screen</li>
                <li>Faster loading times</li>
                <li>Works offline for basic features</li>
                <li>No browser address bar</li>
              </ul>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                background: '#0f6f62',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
