# BUBA — AI Roleplay & Fiction Studio

A responsive, dark-mode roleplay and creative-writing workspace built with plain HTML, CSS and JavaScript plus a small Node/Express backend.

## Features
- Roleplay chat with persistent story context
- Character profiles and universe/AU lore
- Writing studio with local draft autosave
- Story history and local browser persistence
- Provider switch: OpenAI, Anthropic Claude or Google Gemini
- API key stays on the backend (never in browser JavaScript)

## Requirements
- Node.js 18 or newer
- An API key from one supported provider

## Run locally
1. Install Node.js.
2. Open this folder in Terminal.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set `AI_PROVIDER` to `openai`, `anthropic` or `gemini`.
6. Add the matching key:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
7. Run `npm start`.
8. Visit `http://localhost:3000`.

## Important
- ChatGPT subscriptions do not include API usage. API usage is billed separately by the provider.
- Never commit `.env` or share your API key.
- Current stories, characters, universes and writing drafts are stored in this browser's localStorage. They are not yet synced across devices or backed up to a database.
- This starter is intended for local development. Before public deployment, add user accounts, database storage, rate limiting, request size limits, abuse protections and HTTPS.
- The current chat sends the most recent 24 messages plus the selected character, universe and story memory. For very long stories, add a summarization/long-term memory pipeline in a later version.
