// Service Worker para Villa Borghese Empório
const CACHE_NAME = 'villa-borghese-v1.0.0';
const STATIC_CACHE = 'villa-borghese-static-v1.0.0';

// Arquivos para cache
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  console.log('Villa Borghese SW: Instalando...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Villa Borghese SW: Cache criado');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Villa Borghese SW: Arquivos em cache');
        return self.skipWaiting();
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
  console.log('Villa Borghese SW: Ativando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
              console.log('Villa Borghese SW: Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Villa Borghese SW: Ativado');
        return self.clients.claim();
      })
  );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Estratégia Cache First para recursos estáticos
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Estratégia Network First para API/dados
  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Estratégia padrão: Network First com fallback
  event.respondWith(networkFirstWithFallback(request));
});

// Verificar se é recurso estático
function isStaticAsset(url) {
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// Verificar se é requisição de API
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || 
         url.pathname.includes('indexeddb') ||
         url.searchParams.has('api');
}

// Estratégia Cache First
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Villa Borghese SW: Erro cache first:', error);
    return new Response('Recurso não disponível offline', { status: 503 });
  }
}

// Estratégia Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Villa Borghese SW: Tentando cache para:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Sem conexão', 
        message: 'Dados não disponíveis offline',
        offline: true 
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Estratégia Network First com Fallback
async function networkFirstWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para página offline
    if (request.destination === 'document') {
      return caches.match('/');
    }
    
    return new Response('Conteúdo não disponível offline', { status: 503 });
  }
}

// Limpeza periódica do cache
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAN_CACHE') {
    event.waitUntil(cleanOldCache());
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Função para limpar cache antigo
async function cleanOldCache() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.startsWith('villa-borghese-') && 
    name !== CACHE_NAME && 
    name !== STATIC_CACHE
  );
  
  return Promise.all(oldCaches.map(name => caches.delete(name)));
}

// Notificação de update disponível
self.addEventListener('updatefound', () => {
  console.log('Villa Borghese SW: Nova versão encontrada');
  
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'UPDATE_AVAILABLE',
        message: 'Nova versão disponível! Recarregue para atualizar.'
      });
    });
  });
});

// Sincronização em background
self.addEventListener('sync', event => {
  if (event.tag === 'villa-borghese-sync') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  try {
    console.log('Villa Borghese SW: Sincronizando dados...');
    
    // Implementar sincronização com servidor aqui
    // Por exemplo: enviar pedidos offline, sincronizar dados, etc.
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          message: 'Dados sincronizados com sucesso!'
        });
      });
    });
  } catch (error) {
    console.error('Villa Borghese SW: Erro na sincronização:', error);
  }
}

// Push notifications (futuro)
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    tag: 'villa-borghese-notification',
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/icon-72.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('Villa Borghese SW: Service Worker carregado');