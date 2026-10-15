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
  window.open(`https://wa.me/595973345751?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
});


// Filtrado accesible de los proyectos del portafolio.
const projectFilters = document.querySelectorAll('[data-project-filter]');
const projectCards = document.querySelectorAll('[data-project-category]');
projectFilters.forEach((button) => {
  button.addEventListener('click', () => {
    const filter = button.dataset.projectFilter;
    projectFilters.forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle('is-active', isSelected);
      item.setAttribute('aria-pressed', String(isSelected));
    });
    projectCards.forEach((card) => {
      const show = filter === 'all' || card.dataset.projectCategory === filter;
      card.hidden = !show;
      if (show) card.classList.add('visible');
    });
  });
});


// Los botones de Stock seleccionan el producto antes de abrir el formulario de contacto.
document.querySelectorAll('[data-stock-product]').forEach((link) => {
  link.addEventListener('click', () => {
    const product = link.getAttribute('data-stock-product');
    const interest = document.getElementById('interest');
    const message = document.getElementById('message');
    if (interest) {
      const stockOption = [...interest.options].find((option) => option.textContent.trim() === 'Un sistema de stock');
      if (stockOption) interest.value = stockOption.value;
    }
    if (message && !message.value.trim()) message.value = 'Quisiera consultar por ' + product + '.';
  });
});
