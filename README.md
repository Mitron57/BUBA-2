# BUBA — AI Roleplay & Fiction Studio

A static roleplay and creative-writing workspace with story history, character profiles, universe lore and a writing studio.

## Deploy on GitHub Pages

1. In your GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. In **Actions**, run **Deploy BUBA to GitHub Pages** on `main`. Later pushes to `main` deploy automatically.
3. Open the deployment URL. For this fork, it is `https://mitron57.github.io/BUBA/`.

The site uses HTML, CSS and JavaScript. Deployment needs no build dependencies, backend or shared API key.

## Connect an AI provider

1. Open **Settings & API** in BUBA.
2. Choose OpenAI, Anthropic or Gemini and enter your own API key. Use the suggested model or enter a model ID available to your account.
3. Save the settings and start a story.

BUBA sends each request directly to the selected provider. Your browser keeps the key for the tab's session, including page reloads. Use **Remove key** in settings to clear it immediately. The key is accessible to scripts running on the site's origin, so enter it only on a deployment you trust. Your provider bills API usage to your account.

Stories, characters, universes and drafts are stored in this browser. Chat requests include the most recent 24 messages and the selected story context.

## Run locally

From this directory, run `python3 -m http.server 8000` and visit `http://localhost:8000`. Configure a key in the app the same way as on GitHub Pages.
