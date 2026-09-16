# TruthCheck continuation handoff

## Current state

This is a hackathon MVP: a Chrome Manifest V3 extension plus a local Node.js backend. There is no database, authentication, build step, or npm dependency.

The intended end-to-end flow is:

1. The extension injects a **TruthCheck** button on `youtube.com`.
2. The user opens the panel and clicks **Analyze video**.
3. The extension sends the YouTube video ID and selected focus to `POST /api/analyze`.
4. The backend gets captions, extracts up to five factual claims, web-searches for evidence, and returns verdicts.
5. The extension reveals timestamped results while the video plays. It does not reveal new cards while paused.

## Run locally

Prerequisite: Node.js 18+. This WSL installation exposes the executable as `nodejs`; if `npm` is available it will normally invoke Node correctly.

```bash
cd /home/maxb/repos/truth-check
npm run dev
```

Load `extension/` through `chrome://extensions` → Developer mode → **Load unpacked**. After editing extension files, click **Reload** on the TruthCheck extension card and hard-refresh YouTube with `Ctrl+Shift+R`.

For a WSL project location, Explorer can open the extension directory at:

```text
\\wsl.localhost\<distro>\home\maxb\repos\truth-check\extension
```

## Configuration

Runtime settings are in `.env`; it is intentionally ignored by Git. Copy `.env.example` if it does not exist.

```dotenv
DEMO_MODE=false
PORT=8787
LLM_API_KEY=sk-your-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-5.6-luna
```

`DEMO_MODE=true` is the reliable presentation fallback. It returns four bundled claims about climate, vaccines, renewable energy, and Apollo 11 for every video. This is why results do not match the active video in demo mode.

`DEMO_MODE=false` is live mode. It requires `LLM_API_KEY`. The backend uses OpenAI's Responses API and built-in web search; no separate search-provider key is needed.

Never commit `.env` or paste the API key into the extension: the key is read only by the backend.

## Important files

| Path | Purpose |
| --- | --- |
| `extension/content.js` | Injected panel, YouTube video-ID tracking, live reveal, seeking timestamps. |
| `extension/styles.css`, `extension/live.css` | Panel styling. |
| `extension/manifest.json` | MV3 injection setup for YouTube. |
| `server/index.js` | HTTP API and analysis orchestration. |
| `server/services/transcript.js` | YouTube caption adapter and demo transcript. |
| `server/services/claims.js` | Claim extraction LLM stage. |
| `server/services/verify.js` | Evidence-grounded verification stage using OpenAI web search. |
| `server/services/llm.js` | Small Responses API abstraction and JSON parsing. |
| `server/services/demo.js` | Bundled deterministic demonstration results. |
| `test/core.test.js` | Lightweight tests. |

## Current limitations / likely next work

- **Live mode is batch analysis, not streaming inference.** Results are fetched once after Analyze is clicked, then displayed at their timestamps. True real-time analysis would require chunking captions and periodically calling the backend.
- **Caption fetching is intentionally lightweight.** Some videos have no captions, region/consent restrictions, or player-response formats this adapter cannot read. The panel offers pasted-transcript fallback. A production version should use a maintained transcript provider and better language selection.
- **Verification uses model-supplied source metadata.** Preserve the rule that verdicts must be grounded in web-search evidence; improve it by reading source pages and retaining an evidence trace in the response.
- **No automated browser test exists.** Add Playwright or a Chrome-extension smoke test after the hackathon.
- **No persistent configuration.** The API URL is currently hardcoded as `http://localhost:8787` in `extension/content.js`.
- **No UI test control for demo mode.** It is configured solely through `.env`.

## Verify changes

```bash
nodejs --check extension/content.js
nodejs --test test/core.test.js
```

If `npm` is available, this is equivalent for the test suite:

```bash
npm test
```

## Troubleshooting

- **Same four claims on every video:** set `DEMO_MODE=false`, add `LLM_API_KEY`, then restart `npm run dev`.
- **No TruthCheck button:** reload the extension in `chrome://extensions`, then hard-refresh a `youtube.com/watch?v=...` page. Check the extension's **Errors** section for syntax errors.
- **“Transcript unavailable”:** use the Paste transcript option or try a video with English captions.
- **“LLM_API_KEY is not configured”:** add the key to `.env` and restart the backend.
- **Backend unavailable:** verify `http://localhost:8787/health` from the Windows browser/WSL environment where Chrome is running.

