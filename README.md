# Axiom Research Bot

Axiom is a highly sophisticated, locally-stored AI research intelligence bot wrapped in a stunning, cinematic "liquid-glass" user interface. It connects directly to the Groq API for lightning-fast token streaming and saves your research sessions locally using IndexedDB.

![Axiom UI Overview](public/favicon.svg)

## ✨ Features

- **Cinematic Interface:** A fully responsive, dark-mode focused UI with a looping background video and frosted `.liquid-glass` overlays.
- **Lightning Fast Inference:** Powered by the Groq API using the `llama-3.3-70b-versatile` model.
- **Real-time Streaming:** See Axiom's thoughts appear instantly as tokens stream back.
- **Local Privacy:** No backend required! Your sessions, message history, and API keys are stored entirely locally on your device via IndexedDB.
- **Smart Markdown Parsing:** Axiom's responses are cleanly parsed into readable markdown, code blocks, and formatted lists.
- **Customizable Modes:** Easily switch between `Balanced`, `Precise`, and `Exhaustive` research modes to tune Axiom's verbosity and depth.

## 🚀 Tech Stack

- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v3 with custom CSS pseudo-elements for the glass effect
- **Icons:** Lucide React (plus custom SVG paths for social icons)
- **Database:** IndexedDB (`src/db.ts`)
- **API Connectivity:** Native Fetch API with ReadableStream for Groq (`src/groq.ts`)

## 🛠️ Running Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/Vishwajeet2005/Axiom-research-bot.git
   cd Axiom-research-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173/`.

4. **Add your API Key**
   - Click the **Settings** button in the top right.
   - Enter your Groq API Key (starts with `gsk_`).
   - Click **Save Changes** and start researching!

## 📦 Deployment

This project includes a `netlify.toml` file, making it ready for 1-click continuous deployment on Netlify. It automatically builds the Vite app and serves the `dist/` directory.

```bash
# Build for production
npm run build
```

## 📜 License

MIT License. Free to use, modify, and distribute.
