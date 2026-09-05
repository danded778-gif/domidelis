(function () {
  function cartIsEmpty() {
    try {
      return !Array.isArray(carrito) || carrito.length === 0;
    } catch (e) {
      return true;
    }
  }

  function syncCheckoutCta() {
    const vacio = cartIsEmpty();
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    const totalPriceEl = document.getElementById("cart-total-price");

    if (checkoutBtn) {
      checkoutBtn.disabled = vacio;
      checkoutBtn.setAttribute("aria-disabled", vacio ? "true" : "false");
      checkoutBtn.classList.toggle("is-disabled", vacio);
    }

    if (vacio && totalPriceEl) {
      totalPriceEl.innerHTML = typeof formatearPrecio === "function"
        ? formatearPrecio(0)
        : "$0";
    }
  }

  if (typeof actualizarCarritoUI === "function") {
    const original = actualizarCarritoUI;
    actualizarCarritoUI = function () {
      const result = original.apply(this, arguments);
      syncCheckoutCta();
      return result;
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncCheckoutCta);
  } else {
    syncCheckoutCta();
  }
})();
