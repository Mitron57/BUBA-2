# BUBA — AI Roleplay & Fiction Studio

A static roleplay and creative-writing workspace with story history, character profiles, universe lore and a writing studio.

## Deploy on GitHub Pages

1. In your GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. In **Actions**, run **Deploy BUBA to GitHub Pages** on `main`. Later pushes to `main` deploy automatically.
3. Open the deployment URL. For this fork, it is `https://mitron57.github.io/BUBA/`.

The site uses HTML, CSS and JavaScript. Deployment needs no build dependencies, backend or shared API key.

## Connect an AI provider

1. Open **Settings & API** in BUBA.
2. Choose OpenAI, Anthropic or Gemini and enter your own API key.
3. Pick a model from the dropdown and save. BUBA loads the provider’s model catalog when you enter a key. Use **Refresh list** to reload it. Suggested models are available while the catalog loads or if it cannot be reached. **Enter model ID…** lets you use a model outside the dropdown.

BUBA sends each request directly to the selected provider. Your browser keeps the key for the tab's session, including page reloads. Use **Remove key** in settings to clear it immediately. The key is accessible to scripts running on the site's origin, so enter it only on a deployment you trust. Your provider bills API usage to your account.

Stories, characters, universes and drafts are stored in this browser. Chat requests include the most recent 24 messages and the selected story context. Responses stream into the chat and support Markdown formatting.

## Run locally

From this directory, run `python3 -m http.server 8000` and visit `http://localhost:8000`. Configure a key in the app the same way as on GitHub Pages.
