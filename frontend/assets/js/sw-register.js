// ============================================
// sw-register.js — Registra el Service Worker
// Este archivo se incluye en TODAS las páginas HTML
// Ubicación: /frontend/assets/js/sw-register.js
// ============================================

(function() {
  'use strict';

  const SW_PATH = '/firebase-messaging-sw.js';
  
  // ============================================
  // REGISTRAR SERVICE WORKER
  // ============================================
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW Register] Service Worker no soportado');
      return;
    }

    // Detectar si estamos en el scope correcto
    const currentPath = window.location.pathname;
    
    navigator.serviceWorker.register(SW_PATH, {
      scope: '/'
    })
    .then(function(registration) {
      console.log('✅ [SW Register] Service Worker registrado exitosamente');
      console.log('   Scope:', registration.scope);
      
      // Escuchar actualizaciones
      registration.addEventListener('updatefound', function() {
        const newWorker = registration.installing;
        console.log('🔄 [SW Register] Nueva versión encontrada');
        
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Hay una nueva versión disponible
              console.log('🆕 [SW Register] Nueva versión disponible');
              notifyNewVersion(registration);
            } else {
              // Primera instalación
              console.log('✅ [SW Register] Service Worker instalado por primera vez');
            }
          }
        });
      });
      
      // Escuchar cuando toma control
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        console.log('🔄 [SW Register] Nuevo controlador activo');
      });
      
    })
    .catch(function(error) {
      console.error('❌ [SW Register] Error al registrar Service Worker:', error);
      
      // Si falla por scope, intentar sin scope explícito
      if (error.message.includes('scope') || error.message.includes('path')) {
        console.log('[SW Register] Intentando registro sin scope explícito...');
        navigator.serviceWorker.register(SW_PATH)
          .then(function(reg) {
            console.log('✅ [SW Register] Registro exitoso (sin scope)');
          })
          .catch(function(err2) {
            console.error('❌ [SW Register] Segundo intento falló:', err2);
          });
      }
    });
  }

  // ============================================
  // NOTIFICAR NUEVA VERSIÓN
  // ============================================
  function notifyNewVersion(registration) {
    // Crear botón de actualización si no existe
    if (document.getElementById('update-banner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #E63946, #c1121f);
      color: white;
      padding: 12px 24px;
      border-radius: 50px;
      font-family: 'Poppins', sans-serif;
      font-size: 0.9rem;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(230, 57, 70, 0.4);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideUp 0.3s ease;
      cursor: pointer;
    `;
    banner.innerHTML = `
      <i class="fas fa-sync-alt"></i>
      <span>Nueva versión disponible</span>
      <button id="update-btn" style="
        background: white;
        color: #E63946;
        border: none;
        padding: 6px 16px;
        border-radius: 25px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Poppins', sans-serif;
        font-size: 0.85rem;
      ">Actualizar</button>
    `;
    
    document.body.appendChild(banner);
    
    // Agregar animación CSS
    if (!document.getElementById('update-banner-style')) {
      const style = document.createElement('style');
      style.id = 'update-banner-style';
      style.textContent = `
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(100px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Click en actualizar
    document.getElementById('update-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      banner.remove();
      // Recargar después de un breve delay
      setTimeout(function() {
        window.location.reload();
      }, 500);
    });
  }

  // ============================================
  // INICIAR REGISTRO
  // Esperar a que la página esté lista
  // ============================================
  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }

})();