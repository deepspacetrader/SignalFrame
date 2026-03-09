import React from 'react';
import { zzfx } from '../utils/zzfx';

export function SoundTestPanel() {
  const testSound = (soundFunction: () => void, name: string) => {
    console.log(`Testing ${name} sound`);
    soundFunction();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #333',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}
    >
      <div style={{ color: '#fff', marginBottom: '10px', fontWeight: 'bold' }}>
        🎵 Sound Test Panel
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <button
          onClick={() => testSound(() => zzfx.playCompletion(), 'playCompletion')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🎯 Completion
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playSuccess(), 'playSuccess')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          ✅ Success
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playNotification(), 'playNotification')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🔔 Notification
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playPing(), 'playPing')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📍 Ping
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playMultiplePings(3), 'playMultiplePings')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📍📍📍 3x Pings
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playRegeneration(), 'playRegeneration')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🤖 Regeneration
        </button>
        
        <button
          onClick={() => testSound(() => zzfx.playDeepAnalysis(), 'playDeepAnalysis')}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #666',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          🔬 Deep Analysis
        </button>
      </div>
    </div>
  );
}
