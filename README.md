# TruthCheck

TruthCheck is a Chrome Manifest V3 extension with a tiny local API that finds and verifies factual claims while you watch YouTube. It ships in reliable demo mode so a presentation does not depend on third-party APIs.

## Run it now

Prerequisite: Node.js 18+ (Node 20+ recommended). No npm packages are required.

```bash
cd /home/maxb/repos/truth-check
cp .env.example .env
npm run dev
```

The API should say it is listening at `http://localhost:8787` and that demo mode is enabled. Keep that terminal running.

Then load the extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose the `extension` folder in this repository.
4. Open any `https://www.youtube.com/watch?v=...` page.
5. Click the purple **TruthCheck** button at bottom right, choose a focus, and click **Analyze video**.

In demo mode it returns polished, timestamped TRUE/FALSE results immediately and consistently. Clicking a result expands its sources and seeks the video to its approximate timestamp.

## Live mode

Live mode uses one OpenAI API key. It uses the Responses API and OpenAI built-in web search for evidence:

```dotenv
DEMO_MODE=false
LLM_API_KEY=your_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5.6-luna
```

The backend fetches available YouTube captions, extracts up to five relevant factual claims using the selected focus, asks OpenAI web search for evidence, and synthesizes a grounded verdict. If captions cannot be retrieved, the extension offers a transcript-paste fallback. API keys remain solely on the backend.

## Test

```bash
npm test
```

## API

- `GET /health` verifies the server.
- `POST /api/analyze` accepts `{ videoId, focus }`, or `{ transcript, focus }` for the fallback.

The implementation intentionally has no authentication, database, framework, or build tooling; each service is isolated so transcript, search, and LLM providers can be swapped during the hackathon.

## Continuing the project

See [CONTINUATION.md](CONTINUATION.md) for the current handoff, configuration, known limitations, troubleshooting, and suggested next work.
