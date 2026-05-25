# Axiom
 
![Status](https://img.shields.io/badge/Status-Live-success) ![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Groq-informational) ![Deploy](https://img.shields.io/badge/Deployed-Netlify-00C7B7)
 
**Your AI research buddy — a lightweight conversational assistant powered by Llama 3.3 70B via Groq.**
 
🔗 **[Try it → axiom-buddy.netlify.app](https://axiom-buddy.netlify.app)**
 
---
 
## What it does
 
Axiom is a clean, fast research chatbot designed to feel like talking to a knowledgeable friend. No complicated setup, no accounts — just open it and start asking questions. Powered by Llama 3.3 70B (one of the most capable open-weight models) via the Groq API for near-instant responses.
 
---
 
## Features
 
- Conversational interface with chat history
- Powered by `llama-3.3-70b-versatile` for high-quality, nuanced answers
- Zero dependencies — pure HTML, CSS, and vanilla JavaScript
- Deployed on Netlify — always on, no cold starts
- Clean minimal UI optimised for reading long responses
---
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| AI | Groq API (`llama-3.3-70b-versatile`) |
| Deployment | Netlify |
 
---
 
## Getting started
 
```bash
git clone https://github.com/Vishwajeet2005/Axiom-research-bot.git
cd Axiom-research-bot
```
 
Open `index.html` directly in your browser, or serve it locally:
 
```bash
npx serve .
```
 
To use your own Groq API key, add it in the configuration section of `app.js`.
 
---
 
## Project structure
 
```
Axiom-research-bot/
├── index.html    # App shell
├── style.css     # UI styling
└── app.js        # Groq API integration + chat logic
```
 
