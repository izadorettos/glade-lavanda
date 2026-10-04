'use strict';
// Configure uma URL HTTPS de checkout real para ativar o encaminhamento de compra.
const CHECKOUT_URL = 'checkout.html';
const dialog = document.getElementById('purchase-dialog');
const checkoutLink = document.getElementById('checkout-link');
let checkout;
try { checkout = new URL(CHECKOUT_URL, window.location.href); } catch { checkout = null; }
if (checkout && ['https:', 'http:', 'file:'].includes(checkout.protocol)) {
  checkoutLink.href = checkout.href;
  checkoutLink.hidden = false;
  document.getElementById('checkout-message').textContent = 'Confira frete, entrega e formas de pagamento no canal de compra antes de concluir seu pedido.';
}
document.querySelectorAll('[data-buy]').forEach(button => {
  button.addEventListener('click', () => {
    if (checkout) window.location.href = checkout.href;
    else {
      dialog.showModal();
      document.body.classList.add('modal-open');
    }
  });
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});

const kitMainImage = document.getElementById('kit-main-image');
const kitViewport = document.querySelector('[data-kit-viewport]');
const kitNext = document.querySelector('.kit-next');
const kitPrevious = document.querySelector('.kit-previous');
const kitViews = [
  { image: 'assets/kit-lavanda-sem-fundo.png', alt: 'Maleta Glade Coleção Lavanda vista de frente' },
  { image: 'assets/kit-lavanda-lateral.png', alt: 'Maleta Glade Coleção Lavanda vista lateral' },
  { image: 'assets/kit-lavanda-costas.png', alt: 'Maleta Glade Coleção Lavanda vista traseira' }
];
let activeKitView = 0;
let dragStartX = null;

function setKitView(index) {
  activeKitView = (index + kitViews.length) % kitViews.length;
  const view = kitViews[activeKitView];
  kitMainImage.classList.remove('view-changing');
  void kitMainImage.offsetWidth;
  kitMainImage.src = view.image;
  kitMainImage.alt = view.alt;
  kitMainImage.classList.add('view-changing');
  kitPrevious.hidden = activeKitView === 0;
}

kitNext.addEventListener('click', () => setKitView(activeKitView + 1));
kitPrevious.addEventListener('click', () => setKitView(activeKitView - 1));

kitViewport.addEventListener('pointerdown', event => {
  if (event.target.closest('.kit-next, .kit-previous')) return;
  dragStartX = event.clientX;
  kitViewport.setPointerCapture(event.pointerId);
  kitViewport.classList.add('is-dragging');
});

kitViewport.addEventListener('pointerup', event => {
  if (dragStartX === null) return;
  const distance = event.clientX - dragStartX;
  if (Math.abs(distance) > 35) setKitView(activeKitView + (distance < 0 ? 1 : -1));
  dragStartX = null;
  kitViewport.classList.remove('is-dragging');
});

kitViewport.addEventListener('pointercancel', () => {
  dragStartX = null;
  kitViewport.classList.remove('is-dragging');
});

kitViewport.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); setKitView(activeKitView + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); setKitView(activeKitView - 1); }
});

document.querySelectorAll('[data-cep-form]').forEach(form => {
  const input = form.querySelector('input');
  const status = form.querySelector('.cep-status');
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    status.textContent = '';
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const cep = input.value.replace(/\D/g, '');
    status.textContent = cep.length === 8
      ? 'CEP informado. Frete e prazo serão confirmados no checkout.'
      : 'Digite um CEP com 8 números para consultar o frete.';
  });
});

const reviewTrack = document.querySelector('[data-review-track]');
const reviewStep = () => reviewTrack.clientWidth * 0.88;
document.querySelector('[data-review-next]').addEventListener('click', () => reviewTrack.scrollBy({ left: reviewStep(), behavior: 'smooth' }));
document.querySelector('[data-review-prev]').addEventListener('click', () => reviewTrack.scrollBy({ left: -reviewStep(), behavior: 'smooth' }));
reviewTrack.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); reviewTrack.scrollBy({ left: reviewStep(), behavior: 'smooth' }); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); reviewTrack.scrollBy({ left: -reviewStep(), behavior: 'smooth' }); }
});
