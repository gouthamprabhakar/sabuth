// No case data or authenticated pages are stored on the device.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sabuth · Offline</title><body style="font:16px system-ui;padding:48px;line-height:1.7;color:#233a50"><h1>You’re offline.</h1><p>Connect to the internet to view the latest court records.</p><button onclick="location.reload()" style="font:inherit;padding:10px 20px">Try again</button></body></html>',{headers:{'Content-Type':'text/html'}})))}});
