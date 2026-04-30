# TradieTax

AI-powered accounting for sole traders. Features receipt capture, tax bill prediction, Bunnings PowerPass splitting, and GST compliance.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Create a `.env` file based on `.env.example`
   - Add your `GEMINI_API_KEY`

### Running the App

#### Development Mode
To run the full-stack app (Express server + Vite middleware) in development mode:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

#### Production Mode
1. Build the frontend:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm run start
   ```

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, Motion, Lucide React, Recharts
- **Backend**: Node.js, Express
- **AI**: Google Gemini (@google/genai)
- **Database/Auth**: Firebase (Firestore)

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key.
- `APP_URL`: The URL where the app is hosted (e.g., for OAuth callbacks).
- `VITE_FIREBASE_REGION`: The region for your Firestore database.
