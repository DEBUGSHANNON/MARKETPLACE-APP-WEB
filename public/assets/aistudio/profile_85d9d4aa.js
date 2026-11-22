
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  updateProfile,
  reload
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

let profileUser = null;

function profileMessage(message, error = false) {
  $("profileMessage").textContent = message;
  $("profileMessage").style.color =
    error ? "#b42318" : "#21845c";
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }

  profileUser = user;
  $("profileEmail").value = user.email || "";
  $("profileName").value =
    user.displayName || user.email?.split("@")[0] || "";

  $("profileGreeting").textContent =
    user.displayName || "UTM Student";

  $("profileForm").hidden = true;

  try {
    await reload(user);

    $("verificationStatus").textContent =
      user.emailVerified ? "✓ Verified" : "Not verified";

    $("profileStatus").textContent =
      user.emailVerified ? "Verified UTM Student" : "Email not verified";

    const profileRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(profileRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      $("profileName").value =
        data.displayName || $("profileName").value;

const savedPhone = (data.phone || "").replace(/[\s-]/g, "");

$("profilePhone").value = savedPhone.startsWith("+60")
  ? savedPhone.slice(3)
  : savedPhone.startsWith("0")
    ? savedPhone.slice(1)
    : savedPhone;      
$("profileCollege").value = data.college || "";
      $("profileDorm").value = data.dormAddress || "";
    }

    $("profileForm").hidden = false;

  } catch (error) {
    console.error("Could not load profile:", error);
    profileMessage("Could not load your profile. Please refresh.", true);
  }
});


$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();

  const user = profileUser;
  if (!user) return;

  const displayName = $("profileName").value.trim();

  // Get digits entered after the fixed +60 prefix
  const phoneDigits = $("profilePhone").value.replace(/\D/g, "");

  // Validate Malaysian mobile number
  if (phoneDigits && !/^1\d{8,9}$/.test(phoneDigits)) {
    profileMessage(
      "Please enter a valid Malaysian mobile number without the starting 0.",
      true
    );
    return;
  }

  // Add +60 before saving to Firebase
  const phone = phoneDigits ? "+60" + phoneDigits : "";

// Convert a local Malaysian number to +60 format
if (phone.startsWith("0")) {
  phone = "+60" + phone.substring(1);
}

// Remove spaces and hyphens
phone = phone.replace(/[\s-]/g, "");

// Allow blank numbers, or validate Malaysian mobile numbers
if (phone === "+60") {
  phone = "";
}

if (phone && !/^\+601\d{8,9}$/.test(phone)) {
  profileMessage(
    "Please enter a valid Malaysian mobile number, e.g. +60123456789.",
    true
  );
  return;
}  const college = $("profileCollege").value;
  const dormAddress = $("profileDorm").value.trim();

  if (!displayName) {
    profileMessage("Please enter a display name.", true);
    return;
  }

  $("saveProfile").disabled = true;
  $("saveProfile").textContent = "Saving...";

  try {
    // Save the public display name in Firebase Authentication
    await updateProfile(user, { displayName });

    // Save private student details in Firestore
    await setDoc(doc(db, "users", user.uid), {
      displayName,
      email: user.email,
      phone,
      college,
      dormAddress,
      updatedAt: serverTimestamp()
    }, { merge: true });

    $("profileGreeting").textContent = displayName;
    profileMessage("Profile saved successfully!");

  } catch (error) {
    console.error("Could not save profile:", error);
    profileMessage(
      "Could not save your profile. Check Firestore permissions.",
      true
    );
  } finally {
    $("saveProfile").disabled = false;
    $("saveProfile").textContent = "Save Profile ↗";
  }
});
