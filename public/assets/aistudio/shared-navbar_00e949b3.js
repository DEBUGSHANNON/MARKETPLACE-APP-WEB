
import { auth } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const profileButton =
  document.getElementById("homeProfileButton");

const profileMenu =
  document.getElementById("homeProfileMenu");

const username =
  document.getElementById("homeUsername");

const signOutButton =
  document.getElementById("homeSignOut");

let currentUser = null;

onAuthStateChanged(auth, user => {
  currentUser = user;

  profileMenu.hidden = true;
  profileButton.setAttribute("aria-expanded", "false");

  if (user) {
    username.textContent =
      user.displayName?.trim() ||
      user.email?.split("@")[0] ||
      "Student";

    username.hidden = false;
  } else {
    username.textContent = "";
    username.hidden = true;
  }
});

profileButton.addEventListener("click", () => {
  if (!currentUser) {
    document.getElementById("openAuthModal")?.click();
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
  } catch (error) {
    console.error("Sign out failed:", error);
    alert("Could not sign out. Please try again.");
  }
});
