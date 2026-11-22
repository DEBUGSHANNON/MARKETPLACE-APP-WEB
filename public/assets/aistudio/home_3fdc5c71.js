import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut,
  reload,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const profileButton = document.getElementById("homeProfileButton");
const profileMenu = document.getElementById("homeProfileMenu");
const signOutButton = document.getElementById("homeSignOut");
const homeUsername = document.getElementById("homeUsername");

let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;

  profileMenu.hidden = true;
  profileButton.setAttribute("aria-expanded", "false");

  if (user) {
    const username = user.displayName?.trim() ||
      user.email?.split("@")[0] ||
      "Student";

    homeUsername.textContent = username;
    homeUsername.hidden = false;

  } else {
    homeUsername.textContent = "";
    homeUsername.hidden = true;
  }
});

profileButton.addEventListener("click", () => {
  if (!currentUser) {
    openHomeAuthModal();
    return;
  }

  profileMenu.hidden = !profileMenu.hidden;
  profileButton.setAttribute(
    "aria-expanded",
    String(!profileMenu.hidden)
  );
});

document.addEventListener("click", event => {
  if (!event.target.closest(".home-account")) {
    profileMenu.hidden = true;
    profileButton.setAttribute("aria-expanded", "false");
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);

    profileMenu.hidden = true;
    profileButton.setAttribute("aria-expanded", "false");

    showHomeToast("You've signed out successfully!");

  } catch (error) {
    console.error("Could not sign out:", error);
    showHomeToast("Could not sign out. Please try again.");
  }
});

// =====================================
// FIREBASE PRODUCT CAROUSEL
// =====================================

import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

import { db } from "./firebase.js";

const carousel = document.getElementById("homeCarousel");
const carouselArea = document.querySelector(".home-carousel-area");

let carouselPosition = 0;
let isDraggingCarousel = false;
let lastPointerX = 0;
let dragDistance = 0;
let carouselVelocity = 0;
let lastDragTime = 0;
let suppressCarouselClick = false;
let carouselWidth = 0;
let homeListings = [];
let carouselPaused = false;

const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

function escapeCarouselText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderHomeCarousel(listings) {
  if (!listings.length) {
    carousel.innerHTML = `
      <p class="home-carousel-loading">
        No listings yet. Be the first to list something!
      </p>
    `;
    return;
  }

  // Repeat the cards for seamless looping.
// Repeat listings enough times to fill the carousel
const repeated = Array.from(
  { length: Math.max(12, listings.length * 3) },
  (_, index) => listings[index % listings.length]
);
  carousel.innerHTML = repeated.map((item, index) => {
    const rotation = [-9, -5, 0, 5, 9][index % 5];
const offset = [45, 18, 0, 18, 45][index % 5];

    const image = item.imageUrl ||
      (Array.isArray(item.images) ? item.images[0] : "") ||
      "";

    const safeImage = escapeCarouselText(image);
    const title = escapeCarouselText(item.title);
    const category = escapeCarouselText(item.category || "Marketplace");
    const price = Number(item.price || 0);

    return `
  <a
    class="home-product-card"
    href="#product-${escapeCarouselText(item.id)}"
    data-product-id="${escapeCarouselText(item.id)}"
    draggable="false"
    style="--curve-rotate:${rotation}deg;
           --curve-y:${offset}px"
  >
        ${
          safeImage
            ? `<img class="home-product-image"
                    src="${safeImage}"
                    alt="${title}"
                    draggable="false">`
            : `<div class="home-product-image"></div>`
        }

        <div class="home-product-info">
          <span class="home-product-category">${category}</span>
          <h3 class="home-product-title">${title}</h3>
          <strong class="home-product-price">
            RM ${Number.isFinite(price) ? price.toFixed(2) : "0.00"}
          </strong>
        </div>
      </a>
    `;
  }).join("");

 
  // Calculate the width of one product sequence
  const card = carousel.querySelector(".home-product-card");
  const gap = parseFloat(getComputedStyle(carousel).gap) || 24;

  carouselWidth = card
    ? (card.offsetWidth + gap) * listings.length
    : 0;

  // Start at the second sequence
  carouselPosition = -carouselWidth;

  carousel.style.transform =
    `translateX(${carouselPosition}px)`;
}


onSnapshot(
  collection(db, "listings"),
  snapshot => {
    const listings = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => item.status === "available");

homeListings = listings;
renderHomeCarousel(listings);  },
  error => {
    console.error("Carousel Firebase error:", error);
    carousel.innerHTML = `
      <p class="home-carousel-loading">
        Unable to load listings right now.
      </p>
    `;
  }
);

// Automatic scrolling
let previousFrame = 0;

function animateHomeCarousel(time) {
  const delta = previousFrame
    ? Math.min(time - previousFrame, 50)
    : 0;

  previousFrame = time;

  if (carouselWidth > 0 && !isDraggingCarousel) {
  if (Math.abs(carouselVelocity) > 0.02) {
    // Continue moving after releasing the mouse
    carouselPosition += carouselVelocity * delta;

    // Gradually slow down
    carouselVelocity *= Math.pow(0.94, delta / 16);

  } else {
    carouselVelocity = 0;

    // Resume automatic movement
    if (!carouselPaused && !reducedMotion.matches) {
      carouselPosition -= delta * 0.035;
    }
  }
}

  if (carouselWidth > 0) {
    carouselPosition =
      ((carouselPosition % carouselWidth) + carouselWidth)
      % carouselWidth - carouselWidth;

    carousel.style.transform =
      `translateX(${carouselPosition}px)`;
  }

  requestAnimationFrame(animateHomeCarousel);
}

requestAnimationFrame(animateHomeCarousel);

// Pause when hovered
carouselArea.addEventListener("mouseenter", () => {
  carouselPaused = true;
});

carouselArea.addEventListener("mouseleave", () => {
  carouselPaused = false;
});

// Dragging

carouselArea.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  isDraggingCarousel = true;
  lastPointerX = event.clientX;
  dragDistance = 0;
  suppressCarouselClick = false;
  carouselVelocity = 0;
  lastDragTime = performance.now();

  // Do not capture the pointer here.
  // It can interfere with clicks on product cards.
});

carouselArea.addEventListener("pointermove", event => {
  if (!isDraggingCarousel) return;

  const now = performance.now();
  const movement = event.clientX - lastPointerX;
  const elapsed = Math.max(now - lastDragTime, 1);

  lastPointerX = event.clientX;
  lastDragTime = now;

  dragDistance += Math.abs(movement);
  carouselPosition += movement;

  // Velocity is measured in pixels per millisecond
  carouselVelocity = Math.max(
    -1.5,
    Math.min(1.5, movement / elapsed)
  );
});

function finishCarouselDrag() {
  if (!isDraggingCarousel) return;

  isDraggingCarousel = false;
  suppressCarouselClick = dragDistance > 8;

  if (reducedMotion.matches) {
    carouselVelocity = 0;
  }
}

carouselArea.addEventListener("pointerup", finishCarouselDrag);

window.addEventListener("pointerup", finishCarouselDrag);
window.addEventListener("pointercancel", finishCarouselDrag);
carouselArea.addEventListener("pointercancel", finishCarouselDrag);

// =====================================
// PRODUCT DETAILS POPUP
// =====================================

const productModal = document.getElementById("productModal");
const closeProductButton = document.getElementById("closeProductModal");
const reserveProductButton = document.getElementById("productModalReserve");

let selectedProduct = null;
let productModalReturnFocus = null;
function openProductModal(productId) {
    console.log("Opening popup for:", productId);
  const item = homeListings.find(product => product.id === productId);
  console.log("Product found:", item);
  if (!item || !productModal) return;

  selectedProduct = item;
  productModalReturnFocus = document.activeElement;
  carouselPaused = true;

  document.getElementById("productModalTitle").textContent =
    item.title || "Untitled listing";

  document.getElementById("productModalCategory").textContent =
    item.category || "Marketplace";

  document.getElementById("productModalPrice").textContent =
    `RM ${Number(item.price || 0).toFixed(2)}`;

  document.getElementById("productModalDescription").textContent =
    item.description || "No description provided.";

  document.getElementById("productModalCondition").textContent =
    item.condition || "Not specified";

  // Don't display a private student email.
  document.getElementById("productModalSeller").textContent =
    item.sellerName || "UTM student";

  document.getElementById("productModalStatus").textContent =
    item.status === "available" ? "Available" : "Unavailable";

  const imageContainer = document.getElementById("productModalImage");
  imageContainer.replaceChildren();

  const imageUrl = item.imageUrl ||
    (Array.isArray(item.images) ? item.images[0] : "");

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = item.title || "Product photo";
    imageContainer.appendChild(image);
  } else {
    imageContainer.textContent = "📦";
  }

  reserveProductButton.disabled = item.status !== "available";

  productModal.hidden = false;
  document.body.style.overflow = "hidden";
  closeProductButton.focus();
}

function closeProductModal() {
  productModal.hidden = true;
  document.body.style.overflow = "";
  carouselPaused = false;
  selectedProduct = null;

  if (productModalReturnFocus?.isConnected) {
    productModalReturnFocus.focus();
  }
}

/* =====================================
   CLOSE PRODUCT POPUP
===================================== */

closeProductButton.addEventListener("click", () => {
  closeProductModal();
});

// Close when clicking outside the popup
productModal.addEventListener("click", event => {
  if (event.target.hasAttribute("data-close-product")) {
    closeProductModal();
  }
});

// Close with Escape key
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !productModal.hidden) {
    closeProductModal();
  }
});


reserveProductButton.addEventListener("click", async () => {
  if (!selectedProduct) return;

  const productId = selectedProduct.id;

  reserveProductButton.disabled = true;
  reserveProductButton.textContent = "Reserving...";

  const success = await reserveHomeProduct(productId);

  if (success) {
    closeProductModal();
  } else {
    // Restore the button only if the listing is still available
    const item = homeListings.find(
      product => product.id === productId
    );

    reserveProductButton.disabled =
      !item || item.status !== "available";

    reserveProductButton.textContent = "Reserve this item ↗";
  }
});

/* =====================================
   OPEN PRODUCT DETAILS ON CLICK
===================================== */

carousel.addEventListener("click", event => {
  const card = event.target.closest(".home-product-card");

  if (!card) return;

  event.preventDefault();

  // Ignore clicks caused by dragging
  if (suppressCarouselClick || dragDistance > 8) {
    suppressCarouselClick = false;
    dragDistance = 0;
    return;
  }

  const productId = card.dataset.productId;

  console.log("Clicked product:", productId);

  if (productId) {
    openProductModal(productId);
  }
});

/* =====================================
   HOME PAGE FIREBASE RESERVATIONS
===================================== */

let homeToastTimeout;

function showHomeToast(message) {
  const toast = document.getElementById("homeToast");

  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(homeToastTimeout);

  homeToastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

async function reserveHomeProduct(productId) {
  const user = auth.currentUser;

  if (!user) {
  closeProductModal();
  openHomeAuthModal("Please sign in before reserving this item.");
  return false;
}

  // Refresh the user's verification status from Firebase
  try {
    await reload(user);
  } catch (error) {
    console.error("Could not refresh account:", error);
    showHomeToast("Could not verify your account. Please try again.");
    return false;
  }

  if (!user.emailVerified) {
    showHomeToast("Please verify your UTM student email before reserving.");
    return false;
  }

  const listingRef = doc(db, "listings", productId);
  const reservationRef = doc(db, "reservations", productId);

  try {
    await runTransaction(db, async transaction => {
      const listingSnapshot = await transaction.get(listingRef);

      if (!listingSnapshot.exists()) {
        throw new Error("This listing no longer exists.");
      }

      const listing = listingSnapshot.data();

      if (listing.status !== "available") {
        throw new Error("This item is no longer available.");
      }

      if (!listing.sellerId) {
        throw new Error(
          "This listing has no seller account. Please use a listing published by a verified student."
        );
      }

      if (listing.sellerId === user.uid) {
        throw new Error("You cannot reserve your own listing.");
      }

      transaction.update(listingRef, {
        status: "reserved",
        reservedBy: user.uid
      });

      transaction.set(reservationRef, {
        listingId: productId,
        listingTitle: listing.title,
        buyerId: user.uid,
        sellerId: listing.sellerId,
        status: "pending",
        handoverLocation: "",
        handoverDate: "",
        handoverTime: "",
        handoverNote: "",
        handoverLat: null,
        handoverLng: null,
        createdAt: serverTimestamp()
      });
    });

    
showHomeToast("Item reserved successfully! Opening your reservation...");

setTimeout(() => {
  window.location.href =
`reservations.html?reservation=${encodeURIComponent(productId)}#reservations`;}, 1200);

return true;

  } catch (error) {
    console.error("Home reservation error:", error);
    showHomeToast(error.message || "Could not reserve this item.");
    return false;
  }
}

/* =====================================
   HOME STUDENT AUTHENTICATION
===================================== */

const homeAuthModal = document.getElementById("homeAuthModal");
const homeAuthEmail = document.getElementById("homeAuthEmail");
const homeAuthPassword = document.getElementById("homeAuthPassword");
const homeAuthMessage = document.getElementById("homeAuthMessage");
const homeLoginButton = document.getElementById("homeLoginButton");
const homeSignupButton = document.getElementById("homeSignupButton");
const homeResendButton = document.getElementById("homeResendVerification");

const HOME_STUDENT_DOMAIN = "@graduate.utm.my";

function isHomeStudentEmail(email) {
  const value = email.trim().toLowerCase();
  return value.endsWith(HOME_STUDENT_DOMAIN) &&
    value.length > HOME_STUDENT_DOMAIN.length;
}

function setHomeAuthMessage(message, isError = false) {
  homeAuthMessage.textContent = message;
  homeAuthMessage.style.color =
    isError ? "#b42318" : "#21845c";
}

function openHomeAuthModal(message = "") {
  homeAuthModal.hidden = false;
  homeAuthMessage.textContent = message;
  homeResendButton.hidden = true;
  homeAuthPassword.value = "";
  document.body.style.overflow = "hidden";
  homeAuthEmail.focus();
}

function closeHomeAuthModal() {
  homeAuthModal.hidden = true;
  document.body.style.overflow =
    productModal.hidden ? "" : "hidden";
}

function setHomeAuthBusy(busy) {
  homeLoginButton.disabled = busy;
  homeSignupButton.disabled = busy;
  homeResendButton.disabled = busy;
}

async function signInHomeStudent() {
  const email = homeAuthEmail.value.trim();
  const password = homeAuthPassword.value;

  if (!isHomeStudentEmail(email)) {
    setHomeAuthMessage(
      "Please use your @graduate.utm.my student email.",
      true
    );
    return;
  }

  setHomeAuthBusy(true);

  try {
    const credential = await signInWithEmailAndPassword(
      auth, email, password
    );

    await reload(credential.user);

    if (!credential.user.emailVerified) {
      setHomeAuthMessage(
        "Please verify your university email before reserving."
      );
      homeResendButton.hidden = false;
      return;
    }

    closeHomeAuthModal();
    showHomeToast("Signed in successfully!");

  } catch (error) {
    console.error("Sign-in error:", error);
    setHomeAuthMessage(
      "Could not sign in. Check your email and password.",
      true
    );
  } finally {
    setHomeAuthBusy(false);
  }
}

async function createHomeStudentAccount() {
  const email = homeAuthEmail.value.trim();
  const password = homeAuthPassword.value;

  if (!isHomeStudentEmail(email)) {
    setHomeAuthMessage(
      "Please use your @graduate.utm.my student email.",
      true
    );
    return;
  }

  if (password.length < 6) {
    setHomeAuthMessage(
      "Password must contain at least 6 characters.",
      true
    );
    return;
  }

  setHomeAuthBusy(true);

  try {
    const credential = await createUserWithEmailAndPassword(
      auth, email, password
    );

    await sendEmailVerification(credential.user);

    setHomeAuthMessage(
      "Account created! Check your UTM inbox and verify your email."
    );

    homeResendButton.hidden = false;

  } catch (error) {
    console.error("Sign-up error:", error);
    setHomeAuthMessage(
      error.code === "auth/email-already-in-use"
        ? "This email is already registered. Please sign in."
        : "Could not create your account. Please try again.",
      true
    );
  } finally {
    setHomeAuthBusy(false);
  }
}

// Sign in
document.getElementById("homeAuthForm")
  .addEventListener("submit", async event => {
    event.preventDefault();
    await signInHomeStudent();
  });

// Create account
homeSignupButton.addEventListener("click", async () => {
  await createHomeStudentAccount();
});

// Resend verification
homeResendButton.addEventListener("click", async () => {
  const user = auth.currentUser;

  if (!user || user.emailVerified) {
    setHomeAuthMessage(
      "Please sign in to an unverified account first.",
      true
    );
    return;
  }

  homeResendButton.disabled = true;

  try {
    await sendEmailVerification(user);
    setHomeAuthMessage("Verification email sent again.");
  } catch (error) {
    console.error(error);
    setHomeAuthMessage(
      "Could not resend email. Please try again later.",
      true
    );
  } finally {
    homeResendButton.disabled = false;
  }
});

// Close popup
document.getElementById("closeHomeAuth")
  .addEventListener("click", closeHomeAuthModal);

homeAuthModal.addEventListener("click", event => {
  if (event.target === homeAuthModal) {
    closeHomeAuthModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !homeAuthModal.hidden) {
    closeHomeAuthModal();
  }
});
