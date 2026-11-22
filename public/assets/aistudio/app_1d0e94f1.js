import { auth, db, STUDENT_EMAIL_DOMAIN } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  runTransaction,
  getDoc,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
// ====================================
// SIGN IN POPUP
// ====================================

function openAuthModal(message = "") {
  const modal = $("authModal");

  modal.hidden = false;

  $("auth-message").textContent = message;
  $("auth-message").style.color = "#475569";

  document.body.style.overflow = "hidden";
  $("auth-email").focus();
}

function closeAuthModal() {
  $("authModal").hidden = true;

  document.body.style.overflow = "";
}

$("openAuthModal").addEventListener("click", () => {
  openAuthModal();
});

$("closeAuthModal").addEventListener("click", closeAuthModal);

$("authModal").addEventListener("click", event => {
  if (event.target === $("authModal")) {
    closeAuthModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("authModal").hidden) {
    closeAuthModal();
  }
});

// Require a verified student account for protected actions
function requireStudentSignIn() {
  if (!currentUser) {
    openAuthModal("Please sign in to continue.");
    return false;
  }

  if (!currentUser.emailVerified) {
    openAuthModal(
      "Please verify your university email before publishing or reserving."
    );
    return false;
  }

  return true;
}
let currentUser = null;
let allListings = [];
let unsubscribeListings = null;

function showMessage(id, message, isError = false) {
  const el = $(id);
  el.textContent = message;
  el.style.color = isError ? "#b42318" : "#21845c";
}
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function isStudentEmail(email) {
  return email.toLowerCase().endsWith(STUDENT_EMAIL_DOMAIN.toLowerCase());
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}
function money(value) {
  return Number(value || 0).toLocaleString("en-MY", { style:"currency", currency:"MYR" });
}

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  if (!isStudentEmail(email)) {
    showMessage("auth-message", `Please use your student email ending in ${STUDENT_EMAIL_DOMAIN}.`, true);
    return;
  }
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    showMessage("auth-message", "Account created. Check your university inbox and verify your email before using marketplace features.");
  } catch (error) {
    showMessage("auth-message", error.message, true);
  }
});

$("signin-btn").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  if (!isStudentEmail(email)) {
    showMessage("auth-message", `Please use your student email ending in ${STUDENT_EMAIL_DOMAIN}.`, true);
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showMessage("auth-message", "Signed in. If you just verified your email, refresh the page.");
  } catch (error) {
    showMessage("auth-message", error.message, true);
  }
});


$("signout-btn").addEventListener("click", async () => {
  try {
    await signOut(auth);

    // Redirect to Home after successful sign-out
    window.location.replace("index.html");

  } catch (error) {
    console.error("Sign-out error:", error);
    toast("Could not sign out. Please try again.");
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  // Reservations page requires a verified student account
  if (
    window.location.pathname.endsWith("/reservations.html") &&
    (!user || !user.emailVerified)
  ) {
    window.location.replace("index.html");
    return;
  }

    if (!user || !user.emailVerified) {
    if (!$("chatModal").hidden) {
      closeChatModal();
    }
  }
  $("user-label").textContent = user ? user.email : "Not signed in";
  $("signout-btn").classList.toggle("hidden", !user);
  $("reservations").classList.toggle("hidden", !(user && user.emailVerified));
  $("openAuthModal").classList.toggle("hidden", !!user);

if (user && !$("authModal").hidden) {
  closeAuthModal();
}
  if (unsubscribeListings) unsubscribeListings();
  // Everyone can browse public listings
listenToListings();

// Only verified students can load their reservations
if (user && user.emailVerified) {
  loadMyReservations();
} else {
  $("reservation-list").innerHTML = "";
}
});

function listenToListings() {
  const listingsQuery = query(collection(db, "listings"), orderBy("createdAt", "desc"));
  unsubscribeListings = onSnapshot(listingsQuery, (snapshot) => {
    allListings = snapshot.docs.map((item) => ({ id:item.id, ...item.data() }));
    applyFilters();
  }, (error) => {
    console.error(error);
    $("listing-grid").innerHTML = '<div class="empty-state">Could not load listings. Check your Firestore setup and security rules.</div>';
  });
}

function applyFilters() {
  const search = $("search-input").value.trim().toLowerCase();
  const category = $("filter-category").value;
  const type = $("filter-type").value;
  const status = $("filter-status").value;
  const filtered = allListings.filter((item) => {
    const matchesSearch = `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(search);
    return matchesSearch &&
      (category === "all" || item.category === category) &&
      (type === "all" || item.type === type) &&
      (status === "all" || item.status === status);
  });
  renderListings(filtered);
}
["search-input","filter-category","filter-type","filter-status"].forEach((id) => {
  $(id).addEventListener(id === "search-input" ? "input" : "change", applyFilters);
});

function renderListings(items) {
  const grid = $("listing-grid");
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state">No listings found. Try another search or be the first to publish one.</div>';
    return;
  }
  grid.innerHTML = items.map((item) => {
    const status = item.status || "available";
    const image = item.imageUrl
      ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.parentElement.textContent='📦'">`
      : "📦";
const ownListing =
  !!currentUser && item.sellerId === currentUser.uid;    const canReserve = status === "available" && !ownListing;
return `<article
  class="listing-card"
  data-product-id="${escapeHTML(item.id)}"
  tabindex="0"
  role="button"
  aria-label="View details for ${escapeHTML(item.title)}"
>      <div class="listing-image">${image}</div>
      <div class="listing-content">
        <div class="listing-meta"><span class="category-tag">${escapeHTML(item.category)}</span><span class="status-tag ${status}">${status}</span></div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="listing-description">${escapeHTML(item.description)}</p>
        <div class="listing-price">${money(item.price)}</div>
        <div class="listing-footer"><span>${item.type === "service" ? "Service" : "Item"} · Student seller</span>
        ${canReserve ? `<button class="btn btn-primary small-btn" data-reserve="${item.id}">Reserve</button>` : ownListing ? "<span>Your listing</span>" : `<span>${status === "sold" ? "Unavailable" : "Not available"}</span>`}
        </div>
      </div></article>`;
  }).join("");
  grid.querySelectorAll("[data-reserve]").forEach(button => {
  button.addEventListener("click", () => {
    if (!requireStudentSignIn()) return;

    reserveListing(button.dataset.reserve);
  });
});
}

$("listing-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser?.emailVerified) return showMessage("listing-message", "Verify your student email before publishing.", true);
  const title = $("listing-title").value.trim();
  const description = $("listing-description").value.trim();
  const price = Number($("listing-price").value);
  const imageUrl = $("listing-image").value.trim();
  if (!title || !description || !Number.isFinite(price) || price < 0) {
    return showMessage("listing-message", "Please enter valid listing details.", true);
  }
  try {
    await addDoc(collection(db, "listings"), {
      title, description, price, imageUrl,
      type: $("listing-type").value,
      category: $("listing-category").value,
      sellerId: currentUser.uid,
      sellerEmail: currentUser.email,
      status: "available",
      createdAt: serverTimestamp()
    });
    $("listing-form").reset();
    showMessage("listing-message", "Your listing has been published.");
  } catch (error) {
    showMessage("listing-message", error.message, true);
  }
});

async function reserveListing(listingId) {
  if (!currentUser) {
    return toast("Please sign in first.");
  }

  if (!currentUser.emailVerified) {
    return toast("Please verify your student email first.");
  }

  const listingRef = doc(db, "listings", listingId);
  const reservationRef = doc(db, "reservations", listingId);

  try {
    await runTransaction(db, async (transaction) => {
      const listingSnap = await transaction.get(listingRef);

      if (!listingSnap.exists()) {
        throw new Error("This listing no longer exists.");
      }

      const listing = listingSnap.data();

      if (listing.status !== "available") {
        throw new Error("Sorry, this item is already reserved.");
      }

      if (listing.sellerId === currentUser.uid) {
        throw new Error("You cannot reserve your own item.");
      }

      transaction.update(listingRef, {
        status: "reserved",
        reservedBy: currentUser.uid
      });

      transaction.set(reservationRef, {
        listingId: listingId,
        listingTitle: listing.title,
        buyerId: currentUser.uid,
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

    toast("Item reserved successfully!");
    loadMyReservations();

  } catch (error) {
    console.error("Reservation error:", error);
    toast(error.message);
  }
}

let activeReservationTab = "purchases";

function updateReservationTabs() {
  const purchasesTab = $("purchasesTab");
  const salesTab = $("salesTab");

  purchasesTab.classList.toggle(
    "active",
    activeReservationTab === "purchases"
  );

  salesTab.classList.toggle(
    "active",
    activeReservationTab === "sales"
  );

  purchasesTab.setAttribute(
    "aria-pressed",
    String(activeReservationTab === "purchases")
  );

  salesTab.setAttribute(
    "aria-pressed",
    String(activeReservationTab === "sales")
  );
}

$("purchasesTab").addEventListener("click", () => {
  activeReservationTab = "purchases";
  updateReservationTabs();
  loadMyReservations();
});

$("salesTab").addEventListener("click", () => {
  activeReservationTab = "sales";
  updateReservationTabs();
  loadMyReservations();
});

async function loadMyReservations() {
  if (!currentUser?.emailVerified) return;

  const host = $("reservation-list");

  try {
    const [buyerSnap, sellerSnap] = await Promise.all([
      getDocs(query(
        collection(db, "reservations"),
        where("buyerId", "==", currentUser.uid)
      )),
      getDocs(query(
        collection(db, "reservations"),
        where("sellerId", "==", currentUser.uid)
      ))
    ]);

    const docs = new Map();

    [...buyerSnap.docs, ...sellerSnap.docs].forEach(item => {
      docs.set(item.id, { id: item.id, ...item.data() });
    });


const allReservations = [...docs.values()];

const reservations = allReservations.filter(r => {
  if (activeReservationTab === "purchases") {
    return r.buyerId === currentUser.uid;
  }

  return r.sellerId === currentUser.uid;
});
    
if (!reservations.length) {
  host.innerHTML = activeReservationTab === "purchases"
    ? '<div class="empty-state">You have not reserved any items yet.</div>'
    : '<div class="empty-state">No buyers have reserved your listings yet.</div>';
  return;
}

    host.innerHTML = reservations.map(r => {
      const isBuyer = r.buyerId === currentUser.uid;
      const isSeller = r.sellerId === currentUser.uid;

      const hasDetails = Boolean(
        r.handoverLocation &&
        r.handoverDate &&
        r.handoverTime
      );

      const canPropose = isSeller &&
        (r.status === "pending" ||
         r.status === "buyer_counter_proposed");

      const canAccept = isBuyer &&
        r.status === "seller_proposed" && hasDetails;

      const canCounter = isBuyer &&
        r.status === "seller_proposed" && hasDetails;

      const canConfirm = isSeller &&
        r.status === "buyer_counter_proposed" && hasDetails;

      const waiting = isBuyer && r.status === "pending";

      const mapLink =
        Number.isFinite(r.handoverLat) &&
        Number.isFinite(r.handoverLng)
          ? `https://www.google.com/maps/search/?api=1&query=${
              encodeURIComponent(
                `${r.handoverLat},${r.handoverLng}`
              )
            }`
          : "";

      return `
        <article class="reservation-card">
          <div>
            <strong>
              ${escapeHTML(r.listingTitle || "Listing")}
            </strong>

            <p>
              ${isBuyer ? "Your reservation" : "Student reservation"}
              · ${escapeHTML(r.status)}
            </p>

            ${hasDetails ? `
              <p>📍 ${escapeHTML(r.handoverLocation)}</p>

              <p>
                📅 ${escapeHTML(r.handoverDate)}
                · ${escapeHTML(r.handoverTime)}
              </p>

              ${r.handoverNote ? `
                <p>📝 ${escapeHTML(r.handoverNote)}</p>
              ` : ""}

              ${mapLink ? `
                <p>
                  <a href="${mapLink}"
                     target="_blank"
                     rel="noopener noreferrer">
                    View Meeting Point on Google Maps
                  </a>
                </p>
              ` : ""}
            ` : ""}
          </div>

          ${waiting ? `
            <span>Waiting for seller to arrange handover</span>
          ` : ""}
<button
  type="button"
  class="btn btn-secondary small-btn"
  data-chat="${escapeHTML(r.id)}"
>
  💬 ${isBuyer ? "Chat with Seller" : "Chat with Buyer"}
</button>

          ${canPropose ? `
            <button class="btn btn-secondary small-btn"
                    data-handover="${r.id}">
              Arrange Handover
            </button>
          ` : ""}

          ${canConfirm ? `
            <button class="btn btn-primary small-btn"
                    data-confirm="${r.id}">
              Accept Buyer's Changes
            </button>
          ` : ""}

          ${canCounter ? `
            <button class="btn btn-secondary small-btn"
                    data-counter="${r.id}">
              Suggest Changes
            </button>
          ` : ""}

          ${canAccept ? `
            <button class="btn btn-primary small-btn"
                    data-accept-counter="${r.id}">
              Accept Handover
            </button>
          ` : ""}
        </article>
      `;
    }).join("");

host.querySelectorAll("[data-chat]").forEach(button => {
  button.addEventListener("click", () => {
    openChatModal(button.dataset.chat);
  });
});

const reservationToOpen =
  new URLSearchParams(window.location.search)
    .get("reservation");

if (reservationToOpen) {
  
const matchingReservation = allReservations.find(
  r => r.id === reservationToOpen
);

if (matchingReservation) {
  activeReservationTab =
    matchingReservation.buyerId === currentUser.uid
      ? "purchases"
      : "sales";

  updateReservationTabs();
}

  if (matchingReservation) {
    history.replaceState(
      null,
      "",
      window.location.pathname + "#reservations"
    );

    document.getElementById("reservations")
      .scrollIntoView({ behavior: "smooth" });

    await openChatModal(reservationToOpen);
  }
}
    
    host.querySelectorAll("[data-handover]").forEach(button => {
      button.addEventListener("click", () => {
        openHandoverModal(button.dataset.handover, "seller");
      });
    });

    host.querySelectorAll("[data-confirm]").forEach(button => {
      button.addEventListener("click", () => {
        confirmHandover(button.dataset.confirm);
      });
    });

    host.querySelectorAll("[data-counter]").forEach(button => {
      button.addEventListener("click", () => {
        openHandoverModal(button.dataset.counter, "buyer");
      });
    });

    host.querySelectorAll("[data-accept-counter]").forEach(button => {
      button.addEventListener("click", () => {
        acceptCounterHandover(button.dataset.acceptCounter);
      });
    });

  } catch (error) {
    console.error(error);
    host.innerHTML =
      '<div class="empty-state">Could not load reservations.</div>';
  }
}

// ------------------------------------
// ALL-IN-ONE HANDOVER POPUP
// ------------------------------------


let handoverReservationId = null;
let handoverMode = "seller";
let handoverMap = null;
let handoverMarker = null;
let handoverCoordinates = null;

function todayInMalaysia() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const value = type =>
    parts.find(part => part.type === type).value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function setupHandoverTime() {
  const hours = $("handoverHour");
  const minutes = $("handoverMinute");

  if (!hours || !minutes) return;

  if (!hours.options.length) {
    for (let i = 0; i < 24; i++) {
      const value = String(i).padStart(2, "0");
      hours.add(new Option(value, value));
    }
  }

  if (!minutes.options.length) {
    for (let i = 0; i < 60; i += 5) {
      const value = String(i).padStart(2, "0");
      minutes.add(new Option(value, value));
    }
  }
}

function selectHandoverPoint(lat, lng) {
  handoverCoordinates = { lat, lng };

  if (!handoverMap) return;

  const point = [lat, lng];

  if (!handoverMarker) {
    handoverMarker = L.marker(point, {
      draggable: true
    }).addTo(handoverMap);

    handoverMarker.on("dragend", () => {
      const position = handoverMarker.getLatLng();
      selectHandoverPoint(position.lat, position.lng);
    });
  } else {
    handoverMarker.setLatLng(point);
  }

  handoverMap.setView(point, 17);

  // Use a readable location label without needing
  // an external geocoding API.
  const input = $("handoverLocationInput");

  if (!input.value.trim()) {
    input.value =
      `Campus meeting point (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }
}

async function initializeHandoverMap() {
  const mapElement = $("handoverMap");

  if (typeof L === "undefined") {
    mapElement.textContent =
      "Leaflet could not load. Check your internet connection.";
    return;
  }

  const utmCampus = [1.5585, 103.6382];

  if (!handoverMap) {
    mapElement.textContent = "";

    handoverMap = L.map(mapElement).setView(utmCampus, 15);

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    ).addTo(handoverMap);

    handoverMap.on("click", event => {
      selectHandoverPoint(
        event.latlng.lat,
        event.latlng.lng
      );
    });
  }

  handoverMap.invalidateSize();

  if (handoverCoordinates) {
    selectHandoverPoint(
      handoverCoordinates.lat,
      handoverCoordinates.lng
    );
  } else {
    handoverMap.setView(utmCampus, 15);
  }
}
// Search a location and automatically move the Leaflet map
let handoverSearchBusy = false;
const handoverSearchCache = new Map();

async function searchHandoverLocation() {
  const input = $("handoverLocationInput");
  const button = $("searchHandoverLocation");
  const status = $("handoverSearchStatus");

  const placeName = input.value.trim();

  if (!placeName) {
    status.textContent = "Please enter a location name.";
    return;
  }

  if (!handoverMap) {
    status.textContent = "Please wait for the map to load.";
    return;
  }

  if (handoverSearchBusy) return;

  handoverSearchBusy = true;
  button.disabled = true;
  status.textContent = "Searching for your location...";

  try {
    // Add UTM context to improve campus searches
    const searchText =
      `${placeName}, Universiti Teknologi Malaysia, Johor, Malaysia`;

    const cacheKey = searchText.toLowerCase();
    let places = handoverSearchCache.get(cacheKey);

    if (!places) {
      const url = new URL(
        "https://nominatim.openstreetmap.org/search"
      );

      url.searchParams.set("q", searchText);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "my");

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Location search is temporarily unavailable.");
      }

      places = await response.json();
      handoverSearchCache.set(cacheKey, places);
    }

    if (!places.length) {
      status.textContent =
        "Location not found. Try a fuller name or click the map to select it.";
      return;
    }

    const place = places[0];
    const lat = Number(place.lat);
    const lng = Number(place.lon);

    selectHandoverPoint(lat, lng);

    handoverMap.setView([lat, lng], 18);

    input.value = placeName;

    status.textContent =
      "Location found! Check the pin and drag it if needed.";

  } catch (error) {
    console.error(error);
    status.textContent =
      "Search failed. Please try again or select a point on the map.";
  } finally {
    handoverSearchBusy = false;
    button.disabled = false;
  }
}

// Connect the Search Location button
const handoverSearchButton = $("searchHandoverLocation");

if (handoverSearchButton) {
  handoverSearchButton.addEventListener(
    "click",
    searchHandoverLocation
  );
}

function openHandoverModal(reservationId, mode) {
  if (!currentUser?.emailVerified) {
    return toast("Please sign in with a verified student email.");
  }

  const modal = $("handoverModal");

  if (!modal) {
    return toast("Please add the handover popup to index.html.");
  }

  setupHandoverTime();

  handoverReservationId = reservationId;
  handoverMode = mode;

  $("handoverForm").reset();

  modal.querySelector("h2").textContent =
  mode === "buyer"
    ? "Suggest Handover Changes"
    : "Arrange Your Handover";

  $("handoverDateInput").min = todayInMalaysia();
  $("handoverDateInput").value = todayInMalaysia();

  $("handoverHour").value = "14";
  $("handoverMinute").value = "30";

  handoverCoordinates = null;

 if (handoverMarker) {
  handoverMarker.remove();
  handoverMarker = null;
}

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  initializeHandoverMap();
}

function closeHandoverModal() {
  $("handoverModal").hidden = true;
  document.body.style.overflow = "";
  handoverReservationId = null;
}

if ($("handoverModal")) {
  $("closeHandoverModal").addEventListener(
    "click",
    closeHandoverModal
  );

  $("cancelHandoverModal").addEventListener(
    "click",
    closeHandoverModal
  );

  $("handoverModal").addEventListener("click", event => {
    if (event.target === $("handoverModal")) {
      closeHandoverModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !$("handoverModal").hidden
    ) {
      closeHandoverModal();
    }
  });

  $("handoverForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser?.emailVerified || !handoverReservationId) {
      return toast("Please sign in again.");
    }

    const location =
      $("handoverLocationInput").value.trim();

    const date = $("handoverDateInput").value;

    const time =
      `${$("handoverHour").value}:` +
      `${$("handoverMinute").value}`;

    const note = $("handoverNoteInput").value.trim();

    if (!location || location.length > 150) {
      return toast("Choose a valid meeting location.");
    }

    if (!handoverCoordinates) {
      return toast("Please select a pin on Google Maps.");
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < todayInMalaysia()
    ) {
      return toast("Please choose today or a future date.");
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return toast("Please choose a valid time.");
    }

    if (note.length > 300) {
      return toast("Notes cannot exceed 300 characters.");
    }

    const submitButton = $("submitHandover");
    submitButton.disabled = true;

    try {
      const reservationRef = doc(
        db,
        "reservations",
        handoverReservationId
      );

      await runTransaction(db, async transaction => {
        const snapshot =
          await transaction.get(reservationRef);

        if (!snapshot.exists()) {
          throw new Error("Reservation not found.");
        }

        const reservation = snapshot.data();
const isSeller = handoverMode === "seller";

const allowed = isSeller
  ? (
      reservation.status === "pending" ||
      reservation.status === "buyer_counter_proposed"
    )
  : reservation.status === "seller_proposed";

if (
  (isSeller ? reservation.sellerId : reservation.buyerId)
  !== currentUser.uid
) {
  throw new Error("You cannot edit this reservation.");
}

if (!allowed) {
  throw new Error(
    "This proposal is no longer available for changes."
  );
}

if (
  !isSeller &&
  (
    !reservation.handoverLocation ||
    !reservation.handoverDate ||
    !reservation.handoverTime
  )
) {
  throw new Error("Wait for the seller's first proposal.");
}

transaction.update(reservationRef, {
  handoverLocation: location,
  handoverDate: date,
  handoverTime: time,
  handoverNote: note,
  handoverLat: handoverCoordinates.lat,
  handoverLng: handoverCoordinates.lng,
  status: isSeller
    ? "seller_proposed"
    : "buyer_counter_proposed"
    });
      });

      closeHandoverModal();

  toast(
  handoverMode === "seller"
    ? "Handover proposal sent to buyer!"
    : "Suggested changes sent to seller!"
);

      loadMyReservations();

    } catch (error) {
      console.error(error);
      toast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

// ------------------------------------
// SELLER CONFIRMS BUYER'S PROPOSAL
// ------------------------------------

// Seller accepts buyer's suggested changes
async function confirmHandover(reservationId) {
  if (!currentUser) {
    return toast("Please sign in first.");
  }

  try {
    const reservationRef =
      doc(db, "reservations", reservationId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(reservationRef);

      if (!snapshot.exists()) {
        throw new Error("Reservation not found.");
      }

      const reservation = snapshot.data();

      if (reservation.sellerId !== currentUser.uid) {
        throw new Error("Only the seller can confirm.");
      }

      if (reservation.status !== "buyer_counter_proposed") {
        throw new Error(
          "No buyer changes are awaiting acceptance."
        );
      }

      if (
        !reservation.handoverLocation ||
        !reservation.handoverDate ||
        !reservation.handoverTime
      ) {
        throw new Error("Handover details are incomplete.");
      }

      transaction.update(reservationRef, {
        status: "confirmed"
      });
    });

    toast("Handover confirmed successfully!");
    loadMyReservations();

  } catch (error) {
    console.error(error);
    toast(error.message);
  }
}


// Buyer accepts seller's proposal
async function acceptCounterHandover(reservationId) {
  if (!currentUser) {
    return toast("Please sign in first.");
  }

  try {
    const reservationRef =
      doc(db, "reservations", reservationId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(reservationRef);

      if (!snapshot.exists()) {
        throw new Error("Reservation not found.");
      }

      const reservation = snapshot.data();

      if (reservation.buyerId !== currentUser.uid) {
        throw new Error("Only the buyer can accept.");
      }

      if (reservation.status !== "seller_proposed") {
        throw new Error("No seller proposal is pending.");
      }

      if (
        !reservation.handoverLocation ||
        !reservation.handoverDate ||
        !reservation.handoverTime
      ) {
        throw new Error("Handover details are incomplete.");
      }

      transaction.update(reservationRef, {
        status: "confirmed"
      });
    });

    toast("Handover confirmed!");
    loadMyReservations();

  } catch (error) {
    console.error(error);
    toast(error.message);
  }
}


// ====================================
// CAMPUSTRADE REAL-TIME PRIVATE CHAT
// ====================================

let activeChatReservationId = null;
let unsubscribeChatMessages = null;
let chatSending = false;

function stopChatListener() {
  if (unsubscribeChatMessages) {
    unsubscribeChatMessages();
    unsubscribeChatMessages = null;
  }
}

function formatChatTime(timestamp) {
  if (!timestamp?.toDate) return "Sending...";

  return timestamp.toDate().toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderChatMessages(messages) {
  const host = $("chatMessages");
  host.replaceChildren();

  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "No messages yet. Say hello!";
    host.appendChild(empty);
    return;
  }

  for (const message of messages) {
    const bubble = document.createElement("div");

    const mine = message.senderId === currentUser?.uid;

    bubble.className =
      "chat-bubble " + (mine ? "mine" : "theirs");

    const content = document.createElement("div");
    content.textContent = message.text || "";

    const time = document.createElement("small");
    time.textContent = formatChatTime(message.createdAt);

    bubble.appendChild(content);
    bubble.appendChild(time);

    host.appendChild(bubble);
  }

  host.scrollTop = host.scrollHeight;
}

async function openChatModal(reservationId) {
  if (!currentUser?.emailVerified) {
    return toast("Please sign in with a verified student email.");
  }

  try {
    const reservationRef = doc(
      db,
      "reservations",
      reservationId
    );

    const snapshot = await getDoc(reservationRef);

    if (!snapshot.exists()) {
      return toast("Reservation not found.");
    }

    const reservation = snapshot.data();

    const isBuyer =
      reservation.buyerId === currentUser.uid;

    const isSeller =
      reservation.sellerId === currentUser.uid;

    if (!isBuyer && !isSeller) {
      return toast("You cannot access this conversation.");
    }

    stopChatListener();

    activeChatReservationId = reservationId;

    $("chatTitle").textContent =
      isBuyer ? "Chat with Seller" : "Chat with Buyer";

    $("chatSubtitle").textContent =
      reservation.listingTitle || "CampusTrade reservation";

    $("chatInput").value = "";
    $("chatEmojiPanel").hidden = true;
    $("chatEmojiToggle").setAttribute(
      "aria-expanded",
      "false"
    );

    $("chatModal").hidden = false;
    document.body.style.overflow = "hidden";

    $("chatMessages").textContent = "Loading messages...";

    const messagesQuery = query(
      collection(
        db,
        "reservations",
        reservationId,
        "messages"
      ),
      orderBy("createdAt", "asc")
    );

    unsubscribeChatMessages = onSnapshot(
      messagesQuery,
      snapshot => {
        if (activeChatReservationId !== reservationId) {
          return;
        }

        const messages = snapshot.docs.map(item => ({
          id: item.id,
          ...item.data()
        }));

        renderChatMessages(messages);
      },
      error => {
        console.error("Chat listener error:", error);

        $("chatMessages").textContent =
          "Could not load messages. Check Firestore rules.";
      }
    );

    $("chatInput").focus();

  } catch (error) {
    console.error("Open chat error:", error);
    toast(error.message);
  }
}

function closeChatModal() {
  stopChatListener();

  activeChatReservationId = null;

  $("chatModal").hidden = true;
  $("chatEmojiPanel").hidden = true;

  $("chatEmojiToggle").setAttribute(
    "aria-expanded",
    "false"
  );

  document.body.style.overflow =
    $("handoverModal")?.hidden === false
      ? "hidden"
      : "";
}

async function sendChatMessage() {
  const text = $("chatInput").value.trim();

  if (!currentUser?.emailVerified) {
    return toast("Please sign in first.");
  }

  if (!activeChatReservationId) {
    return toast("Please open a conversation.");
  }

  if (!text) return;

  if (text.length > 1000) {
    return toast("Message cannot exceed 1000 characters.");
  }

  if (chatSending) return;

  const reservationId = activeChatReservationId;
  const senderId = currentUser.uid;

  chatSending = true;
  $("chatSend").disabled = true;

  try {
    await addDoc(
      collection(
        db,
        "reservations",
        reservationId,
        "messages"
      ),
      {
        senderId: senderId,
        text: text,
        createdAt: serverTimestamp()
      }
    );

    if (
      activeChatReservationId === reservationId &&
      currentUser?.uid === senderId
    ) {
      $("chatInput").value = "";
      $("chatInput").focus();
    }

  } catch (error) {
    console.error("Send message error:", error);
    toast("Could not send message: " + error.message);
  } finally {
    chatSending = false;
    $("chatSend").disabled = false;
  }
}

// Chat popup events
$("closeChatModal").addEventListener(
  "click",
  closeChatModal
);

$("chatModal").addEventListener("click", event => {
  if (event.target === $("chatModal")) {
    closeChatModal();
  }
});

$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  await sendChatMessage();
});

// Enter sends; Shift + Enter inserts a new line
$("chatInput").addEventListener("keydown", event => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    sendChatMessage();
  }
});

// Emoji picker
$("chatEmojiToggle").addEventListener("click", () => {
  const panel = $("chatEmojiPanel");

  panel.hidden = !panel.hidden;

  $("chatEmojiToggle").setAttribute(
    "aria-expanded",
    String(!panel.hidden)
  );

  $("chatInput").focus();
});

$("chatEmojiPanel")
  .querySelectorAll("[data-emoji]")
  .forEach(button => {
    button.addEventListener("click", () => {
      const input = $("chatInput");
      const emoji = button.dataset.emoji;

      const start = input.selectionStart;
      const end = input.selectionEnd;

      input.setRangeText(emoji, start, end, "end");
      input.focus();
    });
  });

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !$("chatModal").hidden
  ) {
    closeChatModal();
  }
});

$("openCreateListing").addEventListener("click", () => {
  if (!requireStudentSignIn()) return;

  const form = $("create-panel");

  form.classList.toggle("hidden");

  if (!form.classList.contains("hidden")) {
    form.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
});

// =====================================
// LISTINGS PRODUCT DETAILS POPUP
// =====================================

const productModal = $("productModal");
const productReserveButton = $("productModalReserve");

let selectedListingId = null;
let productReturnFocus = null;

function openListingProductModal(listingId) {
  const item = allListings.find(
    listing => listing.id === listingId
  );

  if (!item) {
    toast("This listing could not be found.");
    return;
  }

  selectedListingId = item.id;
  productReturnFocus = document.activeElement;

  $("productModalTitle").textContent =
    item.title || "Untitled listing";

  $("productModalCategory").textContent =
    item.category || "Marketplace";

  $("productModalPrice").textContent = money(item.price);

  $("productModalDescription").textContent =
    item.description || "No description provided.";

  $("productModalCondition").textContent =
    item.condition || "Not specified";

  $("productModalSeller").textContent =
    item.sellerName || "UTM student";

  $("productModalStatus").textContent =
    item.status === "available"
      ? "Available"
      : item.status === "reserved"
        ? "Reserved"
        : "Unavailable";

  const imageContainer = $("productModalImage");
  imageContainer.replaceChildren();

  const imageUrl = item.imageUrl ||
    (Array.isArray(item.images) ? item.images[0] : "");

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = item.title || "Product image";
    image.onerror = () => {
      imageContainer.textContent = "📦";
    };
    imageContainer.appendChild(image);
  } else {
    imageContainer.textContent = "📦";
  }

  const ownListing =
    currentUser && item.sellerId === currentUser.uid;

  productReserveButton.disabled =
    item.status !== "available" || Boolean(ownListing);

  productReserveButton.textContent = ownListing
    ? "This is your listing"
    : item.status !== "available"
      ? "Currently unavailable"
      : "Reserve this item ↗";

  productModal.hidden = false;
  document.body.style.overflow = "hidden";

  $("closeProductModal").focus();
}

function closeListingProductModal() {
  productModal.hidden = true;
  document.body.style.overflow = "";
  selectedListingId = null;

  if (productReturnFocus?.isConnected) {
    productReturnFocus.focus();
  }
}

// Click a listing card to open its details
$("listing-grid").addEventListener("click", event => {
  // Preserve the existing Reserve button
  if (event.target.closest("button, a")) return;

  const card = event.target.closest("[data-product-id]");
  if (!card) return;

  openListingProductModal(card.dataset.productId);
});

// Keyboard accessibility
$("listing-grid").addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("button, a")) return;

  const card = event.target.closest("[data-product-id]");
  if (!card) return;

  event.preventDefault();
  openListingProductModal(card.dataset.productId);
});

// Close popup
$("closeProductModal").addEventListener(
  "click",
  closeListingProductModal
);

productModal.addEventListener("click", event => {
  if (event.target.hasAttribute("data-close-product")) {
    closeListingProductModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !productModal.hidden) {
    closeListingProductModal();
  }
});

// Reserve using the existing Firebase function
productReserveButton.addEventListener("click", async () => {
  if (!selectedListingId) return;

  if (!requireStudentSignIn()) {
    closeListingProductModal();
    return;
  }

  const listingId = selectedListingId;

  productReserveButton.disabled = true;

  try {
    await reserveListing(listingId);
  } finally {
    // Existing Firestore listener refreshes the listing status
    closeListingProductModal();
  }
});
