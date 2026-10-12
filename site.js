// Shared page pieces: fills every [data-include] element from its partial file,
// then marks the current page in the nav, sets the footer year, and wires up the menu button.
(async () => {
  await Promise.all([...document.querySelectorAll('[data-include]')].map(async box => {
    try {
      const res = await fetch(box.dataset.include);
      if (res.ok) box.innerHTML = await res.text();
    } catch {}
  }));

  // "/contact.html", "/contact" and "/contact/" all count as the same page
  const key = path => path.replace(/\/$/, '').split('/').pop().replace(/\.html$/, '') || 'index';
  const here = key(location.pathname);
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (key(new URL(a.href).pathname) === here) a.setAttribute('aria-current', 'page');
  });

  document.querySelectorAll('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });

  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    const setOpen = open => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
    };
    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', e => { if (!e.target.closest('.nav')) setOpen(false); });
  }
})();