// navbar.js — inject + active + fade interno, sicuro
document.addEventListener('DOMContentLoaded', () => {
  const head = document.head;

  // manifest & icone (idempotente)
  const ensureLink = (rel, href, attrs = {}) => {
    if ([...document.querySelectorAll(`link[rel="${rel}"]`)]
        .some(l => l.getAttribute('href') === href)) return;
    const el = document.createElement('link');
    el.rel = rel; el.href = href;
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    head.appendChild(el);
  };

  // NON caricare navbar nelle pagine di auth
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const AUTH_PAGES = new Set(['login.html', 'signup.html', 'forgot.html']);
  if (AUTH_PAGES.has(file)) return;

  // Manifest + icone (se ti serve farlo qui)
  ensureLink('manifest', 'manifest.json');
  ensureLink('icon', 'icons/icon-192.png', { type: 'image/png', sizes: '192x192' });
  ensureLink('apple-touch-icon', 'icons/icon-192.png', { sizes: '192x192' });

  const placeholder = document.getElementById('navbar-placeholder');
  if (!placeholder) return; // pagina senza navbar

  fetch('navbar.html')
    .then(r => r.text())
    .then(html => {
      placeholder.innerHTML = html;

      const topNav = placeholder.querySelector('.top-nav');
      if (!topNav) return;

      // Attiva la voce corrente (ignora query/hash)
      const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      topNav.querySelectorAll('a[href]').forEach(a => {
        try {
          const url = new URL(a.getAttribute('href'), location.origin);
          const hrefFile = (url.pathname.split('/').pop() || 'index.html').toLowerCase();
          if (hrefFile === current) a.classList.add('active');
        } catch { /* href non valido → ignora */ }
      });

      // Fade-out su link interni dell’app
      topNav.querySelectorAll('a[href]').forEach(a => {
        a.addEventListener('click', e => {
          const href = a.getAttribute('href');
          // esterni o anchor: lascia stare
          if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
          }
          // se già sulla stessa pagina, niente fade
          const targetFile = (href.split('?')[0].split('#')[0].split('/').pop() || 'index.html').toLowerCase();
          if (targetFile === current) return;

          e.preventDefault();
          document.body.classList.add('fade-out');
          setTimeout(() => { window.location.href = href; }, 200);
        });
      });
    })
    .catch(err => {
      console.error('[navbar] errore fetch navbar.html:', err);
    });
});