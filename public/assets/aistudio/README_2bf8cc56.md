# CampusTrade starter

A student marketplace starter built with HTML, CSS, JavaScript modules and Firebase Authentication + Cloud Firestore.

## 1. What is included

- Student-email registration and email verification
- Sign in / sign out
- Create item or service listings
- Browse listings with search and category/type/availability filters
- Reserve an available listing using a Firestore transaction
- Suggest a public on-campus handover location, date and time
- Firestore security rules starter

## 2. Requirements

- A Google account
- A Firebase project
- VS Code (recommended)
- The VS Code Live Server extension, or another local web server

Do not open `index.html` directly as a file. JavaScript modules and Firebase imports should be served over HTTP.

## 3. Create and configure Firebase

1. Open https://console.firebase.google.com/ and create a project.
2. In Project settings, add a Web App.
3. Copy the Firebase configuration object.
4. Open `firebase.js` and replace every `YOUR_...` placeholder with your project's values.
5. In `firebase.js`, change `STUDENT_EMAIL_DOMAIN` to your real student email suffix. Example: `@student.example.edu`.
6. In Firebase Authentication > Sign-in method, enable **Email/Password**.
7. In Authentication > Settings > Authorized domains, make sure your development domain is allowed (for example `localhost`).
8. In Firestore Database, create a database.
9. Open Firestore > Rules, paste the contents of `firestore.rules`, change the student email domain there too, and publish.

The email domain is checked in the browser for convenience and in Firestore rules for access control. The Firestore rule is the security boundary; changing only the JavaScript value is not enough.

## 4. Run the website

### Option A: VS Code Live Server

1. Extract the ZIP file.
2. Open the `campustrade` folder in VS Code.
3. Install the **Live Server** extension.
4. Right-click `index.html` and choose **Open with Live Server**.
5. The site should open at an address similar to `http://127.0.0.1:5500`.

### Option B: Python local server

From the project folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## 5. Test the first version

1. Register using an email that ends with your configured student domain.
2. Open the verification email and verify the account.
3. Refresh the website and sign in again if needed.
4. Publish a test listing.
5. Open another browser/private window and sign in with a second verified student account.
6. Reserve the listing from the second account.
7. Check the reservation section and suggest a public campus handover location/date/time.

## 6. Important notes before real deployment

This is a learning MVP, not a production-ready marketplace.

- Replace the example email domain in both `firebase.js` and `firestore.rules`.
- Never publish Firebase Admin credentials or service-account private keys in frontend code.
- Firestore rules should be reviewed and tested before real student data is used.
- Add seller acceptance/cancellation, reservation expiry, and a proper handover confirmation flow before launch.
- Add image uploads through Firebase Storage with Storage security rules; this starter accepts an image URL only.
- Consider using Firebase App Check, moderation/reporting, and a trusted university contact for abuse reports.
- Meet only at public, well-lit campus locations and follow your institution's safety policies.
- Do not store sensitive identity documents or unnecessary personal information.

## 7. Current MVP limitations

- The reservation is marked `reserved` immediately when a buyer requests it. A seller approval workflow is a next development step.
- Handover details are saved as a suggestion; this version does not notify the seller or confirm the meeting.
- Listing images use an external image URL. Firebase Storage upload is not included yet.
- A seller can edit/delete their own listing in Firestore rules, but edit/delete controls are not yet in the interface.