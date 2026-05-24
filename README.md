# AXIOM — Research Intelligence

AXIOM is a research chat bot powered by the **Groq API** and the **llama-3.3-70b-versatile** AI model. It acts as an intelligent research terminal that synthesizes knowledge across various domains with lightning-fast responses.

🚀 **[Live Demo](https://axiom-buddy.netlify.app/)**

## Features

- **Groq API Integration:** Blazing fast inference powered by Groq LPUs.
- **Llama 3.3 70B:** Uses state-of-the-art open-weights model for high-quality research and analysis.
- **Local Key Storage:** Your API key is stored securely in your browser's local storage and is only transmitted directly to Groq's servers.
- **Beautiful UI:** A dynamic and premium user interface with interactive elements, live background canvas, and multiple research modes (Balanced, Precise, Exhaustive).

## Getting Started

### Prerequisites

To run this project locally, you don't need any complex build tools—just a modern web browser and a way to serve the files.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Vishwajeet2005/Axiom-research-bot.git
   cd Axiom-research-bot
   ```

2. **Serve the application:**
   You can use any local development server. For example, using Python or Node.js:
   
   *Using Python:*
   ```bash
   python -m http.server 8000
   ```
   
   *Using Node (npx):*
   ```bash
   npx serve .
   ```

3. **Open the app:**
   Navigate to `http://localhost:8000` (or the port specified by your server) in your web browser.

4. **Initialize Engine:**
   You will need a free [Groq API Key](https://console.groq.com) to start using the research terminal.

## Project Structure

```text
Axiom-research-bot/
├── index.html          # Main HTML structure
├── README.md           # Project documentation
└── assets/
    ├── css/
    │   └── style.css   # Stylesheets
    └── js/
        └── app.js      # Application logic and API interaction
```

## Technologies Used

- **HTML5**
- **Vanilla CSS** (Custom properties, Flexbox, Grid, Animations)
- **Vanilla JavaScript** (ES6+, Fetch API, LocalStorage)

## License

This project is open-source. Feel free to use and modify it.
