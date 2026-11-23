# CampusTrade UTM

An interactive 3D student-to-student campus marketplace for **Universiti Teknologi Malaysia (UTM Skudai)** featuring an interactive Three.js Orbit Sphere discovery experience, catalog filtering, UTM campus handover scheduling, real-time buyer–seller chat, and AI-assisted listing tools.

- **Live Web App (GitHub Pages):** [https://debugshannon.github.io/MARKETPLACE-APP-WEB/](https://debugshannon.github.io/MARKETPLACE-APP-WEB/)
- **Privacy Policy:** [https://debugshannon.github.io/MARKETPLACE-APP-WEB/privacy.html](https://debugshannon.github.io/MARKETPLACE-APP-WEB/privacy.html)

---

## Features

- **Interactive 3D Orbit Sphere:** Explore pre-loved items and campus services arranged around an interactive Three.js sphere with category filtering, spotlight focus, and graceful fallback when WebGL is unavailable.
- **Public Browsing & Verified UTM Sign-In:** Anyone can browse listings publicly without signing in. Publishing items, saving a wishlist, reserving listings, and messaging require a verified `@graduate.utm.my` Google account via Firebase Authentication.
- **UTM Campus Handover Coordination:** Schedule face-to-face meetups at recognized UTM Skudai pickup zones (PSZ Library, Arked Meranti, Faculty of Computing N28, Tasik Ilmu, residential colleges) with interactive proposal/counter-proposal confirmation and real-time chat.
- **AI Marketplace Helpers (Server-Side Gemini API):** Draft listings from notes or photos, ask the Campus Finder for catalog recommendations, view buyer inspection tips, and generate quick chat replies (`server.ts` `/api/ai/*`).
- **Responsive Design & Network Resilience:** Adapts cleanly across desktop and mobile viewports (dedicated 5-tab mobile bottom navigation), with loading skeletons, slow-latency indicators, offline recovery banners, and friendly error states.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, Motion (`motion/react`), Lucide Icons
- **Backend / Dev Server:** Express (`server.ts`) + `@google/genai` (server-side AI proxy routes)
- **Database & Auth:** Firebase Authentication (Google OAuth) & Cloud Firestore (`campustrade-utm-web`, custom security rules in `firestore.rules`)
- **CI/CD:** GitHub Actions static build & deploy to GitHub Pages (`.github/workflows/deploy-pages.yml`)

---

## Prerequisites

- **Node.js** `v20+` (`v22` recommended — matches CI workflow)
- **npm** `v10+`
- *(Optional)* **Firebase CLI** (`npm install -g firebase-tools`) if running the local Firebase Emulator Suite or deploying Firestore security rules

---

## Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/debugshannon/MARKETPLACE-APP-WEB.git
cd MARKETPLACE-APP-WEB
```

### 2. Install dependencies
```bash
npm install --legacy-peer-deps
```

### 3. Configure environment variables
Copy `.env.example` to `.env` and fill in your values (never commit `.env` or real secrets):
```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | For AI routes (`/api/ai/*`) | Google Gemini API key used server-side in `server.ts`. |
| `APP_URL` | Optional | Public URL where the app is hosted. |
| `VITE_USE_FIREBASE_EMULATOR` | Optional (`false` default) | Set to `true` to connect the client to local Firebase Auth/Firestore emulators. |

### 4. Firebase configuration
Client Firebase settings live in `firebase-applet-config.json` (project ID `campustrade-utm-web`, Firestore database ID `ai-studio-ecb9b6c0-4a07-451f-90ec-2ec7aacf2f3b`).

In the Firebase Console for your project:
1. Enable **Google** under **Authentication → Sign-in method**.
2. Add your hosting domain(s) (e.g. `localhost`, `debugshannon.github.io`) under **Authentication → Settings → Authorized domains**.

---

## Running Locally

### Standard Full-Stack Development Server (Port 3000)
Starts Express with Vite middleware (`tsx server.ts`) so both the React frontend and `/api/ai/*` endpoints run together:
```bash
npm run dev
```
Open `http://localhost:3000/`.

### Local Firebase Emulator Mode *(optional)*
1. Start the Firebase Emulators (`auth` on `127.0.0.1:9099`, `firestore` on `127.0.0.1:8080`, UI on `4000`):
   ```bash
   firebase emulators:start
   ```
2. Start the dev server (`npm run dev`) and open:
   `http://localhost:3000/?emulator=true`

---

## Build, Verification & Production Start

### Type-check
```bash
npm run lint
```

### Lint Firestore security rules
```bash
npx eslint firestore.rules
```

### Build for production
Builds the static client bundle into `dist/` (and automatically copies `src/assets/` and `public/` assets including `privacy.html` and `campustrade-logo.jpg`):
```bash
npm run build
```

If hosting under a repository subpath (such as GitHub Pages `/MARKETPLACE-APP-WEB/`), set `VITE_BASE_PATH`:
```bash
VITE_BASE_PATH=/MARKETPLACE-APP-WEB/ npm run build
```

### Preview static build locally
```bash
npm run preview
```

### Run production Node server (Frontend + AI API)
```bash
NODE_ENV=production npm start
```

---

## Deployment

### GitHub Pages (Static Frontend)
Pushing to the `main` branch automatically triggers `.github/workflows/deploy-pages.yml`, which:
1. Installs dependencies with `npm install --legacy-peer-deps`.
2. Builds `dist/` with `VITE_BASE_PATH=/${{ github.event.repository.name }}/`.
3. Publishes `dist/` to GitHub Pages (`https://debugshannon.github.io/MARKETPLACE-APP-WEB/`).

### Firestore Security Rules
Deploy `firestore.rules` to your Firebase project when rules change:
```bash
firebase deploy --only firestore:rules
```

---

## Repository Structure

```text
├── .github/workflows/deploy-pages.yml  # GitHub Pages CI/CD workflow
├── public/                             # Static assets (campustrade-logo.jpg, privacy.html, verification)
├── src/
│   ├── assets/images/                  # Local showcase & brand image assets
│   ├── components/                     # OrbitSphere, CatalogView, Modals, Chat, Handover, Profile UI
│   ├── data/                           # UTM Skudai pickup zones, catalog presets & asset helpers
│   ├── lib/                            # Firebase SDK setup, error helpers, AI client wrapper
│   ├── types/                          # TypeScript domain interfaces
│   ├── App.tsx                         # Main application state, listeners & view routing
│   └── main.tsx                        # React entrypoint
├── server.ts                           # Express server + Gemini API routes + Vite/static serving
├── firestore.rules                     # Role-based & schema-validated Firestore rules
├── firebase.json                       # Firestore rules path & local emulator ports
├── firebase-applet-config.json         # Firebase web app & database configuration
├── index.html                          # HTML entrypoint & metadata
├── package.json                        # Scripts & dependencies
└── vite.config.ts                      # Vite build & GitHub Pages subpath asset plugin
```
