const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

toggle.addEventListener('click', () => {
  toggle.setAttribute('aria-expanded', links.classList.toggle('open'));
});