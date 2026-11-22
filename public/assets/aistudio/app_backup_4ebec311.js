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

$("signout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  $("user-label").textContent = user ? user.email : "Not signed in";
  $("signout-btn").classList.toggle("hidden", !user);
  $("auth-panel").classList.toggle("hidden", !!user);
  $("create-panel").classList.toggle("hidden", !(user && user.emailVerified));
  $("reservations").classList.toggle("hidden", !(user && user.emailVerified));
  if (unsubscribeListings) unsubscribeListings();
  if (user && user.emailVerified) {
    listenToListings();
    loadMyReservations();
  } else {
    allListings = [];
    renderListings([]);
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
  if (!currentUser || !currentUser.emailVerified) {
    grid.innerHTML = '<div class="empty-state">Sign in with a verified student email to browse campus listings.</div>';
    return;
  }
  if (!items.length) {
    grid.innerHTML = '<div class="empty-state">No listings found. Try another search or be the first to publish one.</div>';
    return;
  }
  grid.innerHTML = items.map((item) => {
    const status = item.status || "available";
    const image = item.imageUrl
      ? `<img src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="this.parentElement.textContent='📦'">`
      : "📦";
    const ownListing = item.sellerId === currentUser.uid;
    const canReserve = status === "available" && !ownListing;
    return `<article class="listing-card">
      <div class="listing-image">${image}</div>
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
  grid.querySelectorAll("[data-reserve]").forEach((button) => {
    button.addEventListener("click", () => reserveListing(button.dataset.reserve));
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


async function loadMyReservations() {
  if (!currentUser?.emailVerified) return;

  const host = $("reservation-list");

  try {
    const buyerQuery = query(
      collection(db, "reservations"),
      where("buyerId", "==", currentUser.uid)
    );

    const sellerQuery = query(
      collection(db, "reservations"),
      where("sellerId", "==", currentUser.uid)
    );

    const [buyerSnap, sellerSnap] = await Promise.all([
      getDocs(buyerQuery),
      getDocs(sellerQuery)
    ]);

    const docs = new Map();

    [...buyerSnap.docs, ...sellerSnap.docs].forEach((item) => {
      docs.set(item.id, {
        id: item.id,
        ...item.data()
      });
    });

    const reservations = [...docs.values()];

    if (!reservations.length) {
      host.innerHTML =
        '<div class="empty-state">No reservations yet.</div>';
      return;
    }

    host.innerHTML = reservations.map((r) => {
      const isBuyer = r.buyerId === currentUser.uid;
      const isSeller = r.sellerId === currentUser.uid;

      const canSetHandover =
        isBuyer && r.status === "pending";

      const hasHandoverDetails =
        Boolean(r.handoverLocation) &&
        Boolean(r.handoverDate) &&
        Boolean(r.handoverTime);

      const canConfirmHandover =
        isSeller &&
        r.status === "pending" &&
        hasHandoverDetails;
      const canCounterHandover =
        isSeller &&
        r.status === "pending" &&
        hasHandoverDetails;
        const canAcceptCounter =
          isBuyer &&
          r.status === "counter_proposed" &&
          hasHandoverDetails;

      return `
        <article class="reservation-card">
          <div>
            <strong>
              ${escapeHTML(r.listingTitle || "Listing")}
            </strong>

            <p>
              ${isBuyer
                ? "You requested this item"
                : "A student requested your item"}
              · ${escapeHTML(r.status)}
            </p>

            ${r.handoverLocation ? `
              <p>
                Handover:
                ${escapeHTML(r.handoverLocation)}
                · ${escapeHTML(r.handoverDate)}
                ${escapeHTML(r.handoverTime)}
              </p>
            ` : ""}
          </div>

          ${canSetHandover ? `
            <button
              class="btn btn-secondary small-btn"
              data-handover="${r.id}">
              Suggest handover
            </button>
          ` : ""}

          ${canConfirmHandover ? `
            <button
              class="btn btn-primary small-btn"
              data-confirm="${r.id}">
              Confirm Handover
            </button>
          ` : ""}

          ${canCounterHandover ? `
             <button
              class="btn btn-secondary small-btn"
              data-counter="${r.id}">
              Suggest Different Handover
            </button>
          ` : ""}

          ${canAcceptCounter ? `
            <button
              class="btn btn-primary small-btn"
              data-accept-counter="${r.id}">
              Accept Seller's Proposal
            </button>
          ` : ""}
        </article>
      `;
    }).join("");

    
    // Buyer: suggest handover
    host.querySelectorAll("[data-handover]").forEach((button) => {
      button.addEventListener("click", () => {
        suggestHandover(button.dataset.handover);
      });
    });

    // Seller: confirm handover
    host.querySelectorAll("[data-confirm]").forEach((button) => {
      button.addEventListener("click", () => {
        confirmHandover(button.dataset.confirm);
      });
    });

    // Seller: suggest different handover
    host.querySelectorAll("[data-counter]").forEach((button) => {
      button.addEventListener("click", () => {
        counterHandover(button.dataset.counter);
      });
    });

    // Buyer: accept seller's counter-offer
    host.querySelectorAll("[data-accept-counter]").forEach((button) => {
      button.addEventListener("click", () => {
        acceptCounterHandover(button.dataset.acceptCounter);
      });
    });

  } catch (error) {
    console.error(error);

    host.innerHTML =
      '<div class="empty-state">Could not load reservations. Check the browser console for details.</div>';
  }
}

async function suggestHandover(reservationId) {
  const location = prompt("Choose a public campus meeting point (e.g. library lobby):");
  if (!location) return;
  const date = prompt("Handover date (YYYY-MM-DD):");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Enter the date as YYYY-MM-DD.");
  const time = prompt("Handover time (e.g. 14:30):");
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return toast("Enter the time as HH:MM.");
  try {
    const reservationRef = doc(db, "reservations", reservationId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(reservationRef);
      if (!snap.exists() || snap.data().buyerId !== currentUser.uid) throw new Error("Reservation not found.");
      transaction.update(reservationRef, { handoverLocation:location, handoverDate:date, handoverTime:time });
    });
    toast("Handover suggestion saved. Contact the seller to confirm the arrangement.");
    loadMyReservations();
  } catch (error) {
    toast(error.message);
  }
}

async function confirmHandover(reservationId) {
  if (!currentUser) {
    return toast("Please log in first.");
  }

  try {
    const reservationRef = doc(db, "reservations", reservationId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(reservationRef);

      if (!snap.exists()) {
        throw new Error("Reservation not found.");
      }

      const reservation = snap.data();

      if (reservation.sellerId !== currentUser.uid) {
        throw new Error("Only the seller can confirm the handover.");
      }

      if (reservation.status !== "pending") {
        throw new Error("This reservation is not pending.");
      }

      if (
        !reservation.handoverLocation ||
        !reservation.handoverDate ||
        !reservation.handoverTime
      ) {
        throw new Error("The buyer must suggest handover details first.");
      }

      transaction.update(reservationRef, {
        status: "confirmed"
      });
    });

    toast("Handover confirmed successfully!");
    loadMyReservations();

  } catch (error) {
    toast(error.message);
  }
}

async function counterHandover(reservationId) {
  if (!currentUser) return toast("Please log in.");

  const location = prompt("Suggest a new public campus meeting point:");
  if (!location || location.trim().length > 150) {
    return toast("Enter a location (maximum 150 characters).");
  }

  const date = prompt("New date (YYYY-MM-DD):");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return toast("Enter a valid date format.");
  }

  const time = prompt("New time (HH:MM):");
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return toast("Enter a valid time.");
  }

  try {
    const ref = doc(db, "reservations", reservationId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);

      if (!snap.exists()) {
        throw new Error("Reservation not found.");
      }

      const r = snap.data();

      if (r.sellerId !== currentUser.uid) {
        throw new Error("Only the seller can suggest changes.");
      }

      if (r.status !== "pending") {
        throw new Error("Reservation is not pending.");
      }

      if (!r.handoverLocation || !r.handoverDate || !r.handoverTime) {
        throw new Error("Wait for the buyer's first proposal.");
      }

      transaction.update(ref, {
        handoverLocation: location.trim(),
        handoverDate: date,
        handoverTime: time,
        status: "counter_proposed"
      });
    });

    toast("New handover details sent to buyer!");
    loadMyReservations();

  } catch (error) {
    toast(error.message);
  }
}

async function acceptCounterHandover(reservationId) {
  if (!currentUser) {
    return toast("Please log in first.");
  }

  try {
    const reservationRef = doc(db, "reservations", reservationId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(reservationRef);

      if (!snap.exists()) {
        throw new Error("Reservation not found.");
      }

      const reservation = snap.data();

      if (reservation.buyerId !== currentUser.uid) {
        throw new Error("Only the buyer can accept this proposal.");
      }

      if (reservation.status !== "counter_proposed") {
        throw new Error("No counter-offer is waiting for acceptance.");
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
    toast(error.message);
  }
}
