(() => {
  "use strict";

  const STORAGE_KEY = "grandHallTicketCart_v1";

  const prices = {
    premium: 85,
    standard: 60,
    balcony: 40
  };

  const sectionNames = {
    premium: "Premium",
    standard: "Standard",
    balcony: "Balcony"
  };

  const rowLetters = "ABCDEFGHIJ";
  const seats = [];

  const unavailableIds = new Set([
    "A-4", "A-15", "B-8", "C-2", "C-18", "D-11",
    "E-6", "F-14", "G-3", "H-17", "I-9", "J-5"
  ]);

  // Generate all seats dynamically.
  rowLetters.split("").forEach((row, rowIndex) => {
    const section =
      rowIndex < 3 ? "premium" :
      rowIndex < 7 ? "standard" :
      "balcony";

    const count =
      rowIndex < 3 ? 18 :
      rowIndex < 7 ? 20 :
      22;

    for (let number = 1; number <= count; number++) {
      const id = `${row}-${number}`;

      seats.push({
        id,
        row,
        number,
        section,
        price: prices[section],
        unavailable: unavailableIds.has(id)
      });
    }
  });

  // HTML elements
  const $ = (id) => document.getElementById(id);

  const mapElement = $("seatingMap");
  const viewport = $("mapViewport");
  const mapContent = $("mapContent");

  let inspectedId = null;
  let cart = [];
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let toastTimer = null;

  // Restore cart from localStorage.
  function loadCart() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      if (!Array.isArray(saved)) return [];

      const validIds = new Set(
        seats
          .filter(seat => !seat.unavailable)
          .map(seat => seat.id)
      );

      return [
        ...new Set(
          saved.filter(
            id => typeof id === "string" && validIds.has(id)
          )
        )
      ];

    } catch (error) {
      console.warn("Could not restore the saved cart:", error);
      return [];
    }
  }

  // Save cart to localStorage.
  function saveCart() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cart)
      );
    } catch (error) {
      showToast("Your browser could not save the cart.");
    }
  }

  function seatById(id) {
    return seats.find(seat => seat.id === id);
  }

  // Generate the seating map.
  function renderMap() {
    mapElement.innerHTML = "";

    const rows = [...new Set(seats.map(seat => seat.row))];

    rows.forEach(row => {
      const rowSeats = seats.filter(
        seat => seat.row === row
      );

      const rowEl = document.createElement("div");
      rowEl.className = "seat-row";

      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = row;

      rowEl.appendChild(label);

      // Create three seat blocks with aisles.
      const blockSize = Math.ceil(rowSeats.length / 3);

      for (let block = 0; block < 3; block++) {
        const group = document.createElement("div");
        group.className = "seat-group";

        rowSeats
          .slice(
            block * blockSize,
            (block + 1) * blockSize
          )
          .forEach(seat => {

            const button = document.createElement("button");

            button.type = "button";
            button.className = `seat ${seat.section}`;
            button.dataset.seatId = seat.id;

            button.setAttribute(
              "aria-label",
              `Row ${seat.row}, seat ${seat.number}, ${sectionNames[seat.section]}, $${seat.price}`
            );

            button.title =
              `${seat.id} · ${sectionNames[seat.section]} · $${seat.price}`;

            button.addEventListener("click", () => {
              inspectSeat(seat.id);
            });

            group.appendChild(button);
          });

        rowEl.appendChild(group);
      }

      mapElement.appendChild(rowEl);
    });

    updateSeatStates();
  }

  // Synchronize seat colors and states.
  function updateSeatStates() {
    mapElement.querySelectorAll(".seat").forEach(button => {
      const seat = seatById(button.dataset.seatId);

      button.classList.remove(
        "inspected",
        "in-cart",
        "unavailable"
      );

      button.disabled = false;

      if (seat.unavailable) {
        button.classList.add("unavailable");
        button.disabled = true;

        button.setAttribute(
          "aria-label",
          `${seat.id}, unavailable`
        );

      } else if (cart.includes(seat.id)) {
        button.classList.add("in-cart");
        button.disabled = true;

        button.setAttribute(
          "aria-label",
          `${seat.id}, in cart`
        );

      } else if (seat.id === inspectedId) {
        button.classList.add("inspected");

        button.setAttribute(
          "aria-label",
          `${seat.id}, currently inspected`
        );
      }
    });
  }

  // Inspect a seat without adding it to the cart.
  function inspectSeat(id) {
    const seat = seatById(id);

    if (!seat || seat.unavailable) return;

    if (cart.includes(id)) {
      showToast("This seat is already in your cart.");
      return;
    }

    inspectedId = id;

    $("emptySelection").classList.add("hidden");
    $("selectedDetails").classList.remove("hidden");

    $("detailNumber").textContent = id;
    $("selectedSeatName").textContent = `Seat ${id}`;

    $("detailSection").textContent =
      sectionNames[seat.section];

    $("detailRow").textContent = seat.row;
    $("detailSeat").textContent = seat.number;
    $("detailStatus").textContent = "Available";
    $("detailPrice").textContent = formatPrice(seat.price);

    $("addToCart").disabled = false;
    $("addToCart").innerHTML =
      'ADD TO CART <span>↗</span>';

    $("detailMessage").textContent =
      "Your seat is not reserved until it is added to your cart.";

    updateSeatStates();
  }

  // Add inspected seat to cart.
  function addToCart() {
    if (!inspectedId) return;

    const seat = seatById(inspectedId);

    if (
      !seat ||
      seat.unavailable ||
      cart.includes(inspectedId)
    ) {
      showToast("This seat cannot be added.");
      return;
    }

    cart.push(inspectedId);

    saveCart();
    renderCart();
    updateSeatStates();

    $("detailStatus").textContent = "In cart";

    $("addToCart").disabled = true;
    $("addToCart").textContent = "ADDED TO CART";

    $("detailMessage").textContent =
      "This ticket is now in your cart.";

    showToast(`Seat ${inspectedId} added to your cart.`);

    inspectedId = null;
  }

  // Remove a ticket from cart.
  function removeFromCart(id) {
    cart = cart.filter(item => item !== id);

    saveCart();
    renderCart();
    updateSeatStates();

    if ($("detailNumber").textContent === id) {
      $("detailStatus").textContent = "Available";

      $("addToCart").disabled = false;

      $("addToCart").innerHTML =
        'ADD TO CART <span>↗</span>';
    }

    showToast(`Seat ${id} removed from your cart.`);
  }

  // Display cart items and calculate total.
  function renderCart() {
    const container = $("cartItems");

    container.innerHTML = "";

    if (cart.length === 0) {
      const empty = document.createElement("div");

      empty.className = "empty-cart";

      empty.innerHTML = `
        <span>＋</span>
        <p>Your cart is empty.</p>
        <small>Your selected tickets will appear here.</small>
      `;

      container.appendChild(empty);

    } else {
      cart.forEach(id => {
        const seat = seatById(id);

        if (!seat) return;

        const item = document.createElement("div");
        item.className = "cart-item";

        const info = document.createElement("div");

        const name = document.createElement("span");
        name.className = "cart-item-name";
        name.textContent = `Seat ${seat.id}`;

        const section = document.createElement("small");
        section.className = "cart-item-section";
        section.textContent = sectionNames[seat.section];

        info.append(name, section);

        const price = document.createElement("span");
        price.className = "cart-item-price";
        price.textContent = formatPrice(seat.price);

        const remove = document.createElement("button");

        remove.type = "button";
        remove.className = "remove-ticket";
        remove.textContent = "×";

        remove.setAttribute(
          "aria-label",
          `Remove seat ${seat.id}`
        );

        remove.title = `Remove seat ${seat.id}`;

        remove.addEventListener("click", () => {
          removeFromCart(id);
        });

        item.append(info, price, remove);

        container.appendChild(item);
      });
    }

    const total = cart.reduce(
      (sum, id) => sum + (seatById(id)?.price || 0),
      0
    );

    $("cartCount").textContent = cart.length;
    $("cartTotal").textContent = formatPrice(total);

    $("checkoutButton").disabled = cart.length === 0;
  }

  function formatPrice(value) {
    return `$${value.toFixed(2)}`;
  }

  // Display notification messages.
  function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2300);
  }

  // Map zoom and navigation.
  function applyTransform() {
    mapContent.style.transform =
      `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  }

  function zoomBy(amount) {
    zoom = Math.max(
      0.72,
      Math.min(1.55, +(zoom + amount).toFixed(2))
    );

    applyTransform();
  }

  function moveBy(x, y) {
    offsetX = Math.max(
      -220,
      Math.min(220, offsetX + x)
    );

    offsetY = Math.max(
      -180,
      Math.min(180, offsetY + y)
    );

    applyTransform();
  }

  function resetView() {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;

    applyTransform();
  }

  // Navigation button events.
  $("zoomIn").addEventListener("click", () => {
    zoomBy(0.12);
  });

  $("zoomOut").addEventListener("click", () => {
    zoomBy(-0.12);
  });

  $("moveUp").addEventListener("click", () => {
    moveBy(0, 35);
  });

  $("moveDown").addEventListener("click", () => {
    moveBy(0, -35);
  });

  $("moveLeft").addEventListener("click", () => {
    moveBy(35, 0);
  });

  $("moveRight").addEventListener("click", () => {
    moveBy(-35, 0);
  });

  $("resetView").addEventListener("click", resetView);

  // Mouse-wheel zoom.
  viewport.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      zoomBy(event.deltaY < 0 ? 0.08 : -0.08);
    },
    { passive: false }
  );

  // Drag-to-pan functionality.
  let dragging = false;

  let dragStartX = 0;
  let dragStartY = 0;

  let startOffsetX = 0;
  let startOffsetY = 0;

  viewport.addEventListener("pointerdown", event => {
    if (event.target.closest("button")) return;

    dragging = true;

    viewport.classList.add("dragging");

    dragStartX = event.clientX;
    dragStartY = event.clientY;

    startOffsetX = offsetX;
    startOffsetY = offsetY;

    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", event => {
    if (!dragging) return;

    offsetX = Math.max(
      -220,
      Math.min(
        220,
        startOffsetX + event.clientX - dragStartX
      )
    );

    offsetY = Math.max(
      -180,
      Math.min(
        180,
        startOffsetY + event.clientY - dragStartY
      )
    );

    applyTransform();
  });

  function stopDragging() {
    dragging = false;
    viewport.classList.remove("dragging");
  }

  viewport.addEventListener("pointerup", stopDragging);
  viewport.addEventListener("pointercancel", stopDragging);

  // Demo checkout. No real payment is processed.
  $("addToCart").addEventListener("click", addToCart);
  $("checkoutButton").addEventListener("click", () => {
    if (!cart.length) return;

    const total = cart.reduce(
      (sum, id) => sum + seatById(id).price,
      0
    );

    $("modalSummary").textContent =
      `You have selected ${cart.length} ${
        cart.length === 1 ? "ticket" : "tickets"
      } for ${formatPrice(total)}.`;

    $("checkoutModal").classList.remove("hidden");
  });

  function closeModal() {
    $("checkoutModal").classList.add("hidden");
  }

  $("closeModal").addEventListener("click", closeModal);
  $("finishDemo").addEventListener("click", closeModal);

  $("checkoutModal").addEventListener("click", event => {
    if (event.target === $("checkoutModal")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  // Initialize the website.
  cart = loadCart();

  renderMap();
  renderCart();
  resetView();

})();