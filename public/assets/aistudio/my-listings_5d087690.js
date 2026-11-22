
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let myListings = [];
let editingId = null;
let unsubscribe = null;

function message(text, error = false) {
  $("myListingsMessage").textContent = text;
  $("myListingsMessage").style.color =
    error ? "#b42318" : "#506556";
}

function formatPrice(price) {
  return `RM ${Number(price || 0).toFixed(2)}`;
}

onAuthStateChanged(auth, user => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  currentUser = user;
  myListings = [];

  if (!user) {
    window.location.replace("index.html");
    return;
  }

  message("Loading your listings...");

  const listingsQuery = query(
    collection(db, "listings"),
    where("sellerId", "==", user.uid)
  );

  unsubscribe = onSnapshot(listingsQuery, snapshot => {
    myListings = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    renderMyListings();
  }, error => {
    console.error("Could not load listings:", error);
    message("Could not load your listings. Check Firestore permissions.", true);
  });
});

function renderMyListings() {
  $("totalListings").textContent = myListings.length;
  $("availableListings").textContent =
    myListings.filter(item => item.status === "available").length;
  $("reservedListings").textContent =
    myListings.filter(item => item.status === "reserved").length;

  const grid = $("myListingsGrid");
  grid.replaceChildren();

  if (!myListings.length) {
    message("You haven't created any listings yet. Add your first item!");
    return;
  }

  message("");

  myListings.forEach(item => {
    const card = document.createElement("article");
    card.className = "my-card";

    const imageBox = document.createElement("div");
    imageBox.className = "my-card-image";

    const imageUrl = item.imageUrl ||
      (Array.isArray(item.images) ? item.images[0] : "");

    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = item.title || "Listing image";
      image.loading = "lazy";
      image.onerror = () => {
        imageBox.textContent = "📦";
      };
      imageBox.appendChild(image);
    } else {
      imageBox.textContent = "📦";
    }

    const content = document.createElement("div");
    content.className = "my-card-content";

    const category = document.createElement("span");
    category.className = "my-card-category";
    category.textContent = item.category || "Marketplace";

    const title = document.createElement("h3");
    title.textContent = item.title || "Untitled listing";

    const description = document.createElement("p");
    description.className = "my-card-description";
    description.textContent = item.description || "No description";

    const price = document.createElement("div");
    price.className = "my-card-price";
    price.textContent = formatPrice(item.price);

    const status = document.createElement("span");
    const listingStatus = item.status || "available";
    status.className = "my-status";
    if (["reserved", "sold"].includes(listingStatus)) {
      status.classList.add(listingStatus);
    }
    status.textContent = listingStatus;

    const actions = document.createElement("div");
    actions.className = "my-card-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openEdit(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "my-delete";
    deleteButton.textContent = "Delete";

    // Don't delete listings involved in a reservation.
    deleteButton.disabled = listingStatus !== "available";
    deleteButton.addEventListener("click", () => deleteListing(item.id));

    actions.append(editButton, deleteButton);
    content.append(category, title, description, price, status, actions);
    card.append(imageBox, content);
    grid.appendChild(card);
  });
}

function openEdit(listingId) {
  const item = myListings.find(item => item.id === listingId);
  if (!item) return;

  editingId = listingId;

  $("myEditName").value = item.title || "";
  $("myEditDescription").value = item.description || "";
  $("myEditPrice").value = item.price ?? 0;
  $("myEditCategory").value = item.category || "";

  const conditionSelect = $("myEditCondition");
  conditionSelect.value = item.condition || "Not specified";

  if (!conditionSelect.value) {
    conditionSelect.value = "Not specified";
  }

  $("myEditModal").hidden = false;
  document.body.style.overflow = "hidden";
  $("myEditName").focus();
}

function closeEdit() {
  $("myEditModal").hidden = true;
  document.body.style.overflow = "";
  editingId = null;
}

$("myEditClose").addEventListener("click", closeEdit);

$("myEditModal").addEventListener("click", event => {
  if (event.target === $("myEditModal")) closeEdit();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("myEditModal").hidden) {
    closeEdit();
  }
});

$("myEditForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || !editingId) return;

  const listingId = editingId;
  const item = myListings.find(item => item.id === listingId);

  if (!item || item.sellerId !== currentUser.uid) {
    message("You can only edit your own listings.", true);
    return;
  }

  const title = $("myEditName").value.trim();
  const description = $("myEditDescription").value.trim();
  const category = $("myEditCategory").value.trim();
  const price = Number($("myEditPrice").value);
  const condition = $("myEditCondition").value;

  if (!title || !description || !category ||
      !Number.isFinite(price) || price < 0) {
    message("Please enter valid listing details.", true);
    return;
  }

  const saveButton = $("myEditSave");
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    await updateDoc(doc(db, "listings", listingId), {
      title,
      description,
      price,
      category,
      condition,
      updatedAt: serverTimestamp()
    });

    closeEdit();
    message("Listing updated successfully!");
  } catch (error) {
    console.error("Edit failed:", error);
    message("Could not update listing. Check permissions.", true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Changes ↗";
  }
});

async function deleteListing(listingId) {
  const item = myListings.find(item => item.id === listingId);

  if (!currentUser || !item ||
      item.sellerId !== currentUser.uid) return;

  if (!confirm(`Delete "${item.title}" permanently?`)) return;

  try {
    const listingRef = doc(db, "listings", listingId);

    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(listingRef);

      if (!snapshot.exists()) {
        throw new Error("Listing no longer exists.");
      }

      const latest = snapshot.data();

      if (latest.sellerId !== currentUser.uid) {
        throw new Error("You do not own this listing.");
      }

      if (latest.status !== "available") {
        throw new Error("Reserved or sold listings cannot be deleted.");
      }

      transaction.delete(listingRef);
    });

    message("Listing deleted successfully!");
  } catch (error) {
    console.error("Delete failed:", error);
    message(error.message || "Could not delete listing.", true);
  }
}
