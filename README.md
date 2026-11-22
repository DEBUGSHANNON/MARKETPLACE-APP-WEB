# CampusTrade UTM

Interactive 3D student-to-student marketplace for Universiti Teknologi Malaysia (UTM Skudai), built with React, Three.js, Express, Gemini AI (`gemini-4-hydrogen`), Firebase Auth, and Cloud Firestore.

## Live Firebase Project (AI Studio Provisioned)

- **Firebase Project ID:** `gen-lang-client-0143853357`
- **Firestore Database ID:** `ai-studio-ecb9b6c0-4a07-451f-90ec-2ec7aacf2f3b`
- **Firestore Console:** `https://console.firebase.google.com/project/gen-lang-client-0143853357/firestore/databases/ai-studio-ecb9b6c0-4a07-451f-90ec-2ec7aacf2f3b/data`
- **Authentication Console:** `https://console.firebase.google.com/project/gen-lang-client-0143853357/authentication/users`

## Running Locally in Visual Studio Code

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Create `.env` from `.env.example`:**
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` if you want to test the AI features locally.
3. **Start the app (live Firebase mode):**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

## Testing Buyer & Seller with Firebase Local Emulator

Requires **Java (JDK 11+)** and **Firebase CLI** (`npm install -g firebase-tools`) installed on your computer.

1. **Terminal 1 — Start Firebase Emulators:**
   ```bash
   firebase emulators:start
   ```
   - Emulator UI: `http://127.0.0.1:4000`
   - Auth Emulator: `127.0.0.1:9099`
   - Firestore Emulator: `127.0.0.1:8080`
2. **Terminal 2 — Start the App:**
   ```bash
   npm run dev
   ```
3. **Open Emulator Mode in your browser:**
   Visit `http://localhost:3000/?emulator=true`
   - Use the bottom-left **Emulator: Seller | Buyer | Seed Items** bar to publish/seed items as Seller, switch to Buyer, reserve an object, and test real-time chat + UTM handover proposals.
