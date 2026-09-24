const header = document.querySelector('.site-header');
const menuBtn = document.getElementById('menuBtn');
const nav = document.getElementById('nav');
const year = document.getElementById('year');
const glow = document.getElementById('cursorGlow');

year.textContent = new Date().getFullYear();

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
});

menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.classList.toggle('active', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
});

document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuBtn.classList.remove('active');
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.13 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

if (window.matchMedia('(pointer:fine)').matches) {
  window.addEventListener('pointermove', e => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  });
}



// Evita que el botón flotante de WhatsApp tape texto en la sección de contacto o el pie de página.
const waFloat = document.querySelector('.wa-float');
const waBlockers = [document.querySelector('#contacto'), document.querySelector('footer')].filter(Boolean);
const visibleBlockers = new Set();

if (waFloat && waBlockers.length) {
  const waObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleBlockers.add(entry.target);
      else visibleBlockers.delete(entry.target);
    });
    waFloat.classList.toggle('is-hidden', visibleBlockers.size > 0);
  }, { threshold: 0.08 });

  waBlockers.forEach((el) => waObserver.observe(el));
}

document.getElementById('contactForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const interest = document.getElementById('interest').value;
  const message = document.getElementById('message').value.trim();
  const text = `Hola Velturio, soy ${name}. Me interesa: ${interest}.${message ? `\n\n${message}` : ''}`;
  window.open(`https://wa.me/595991737133?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
});
