# TruthCheck

**Read with receipts.**

TruthCheck is a Chrome extension that fact-checks claims as they happen — while you watch a YouTube video, or over any text you highlight on the web. No new tab, no separate search: it quietly checks what's being said and shows the evidence right where you're already looking.

## The problem

Claims move faster than fact-checking does. A video makes a statement, you keep watching, and by the time it'd occur to you to check it, ten more have gone by. The tools that do exist ask for the opposite of convenience: copy the claim, paste it somewhere, search it yourself, read through results, decide who to trust. That friction is exactly why most claims — true or false — never get checked at all.

## What it does

- **On YouTube** — a live caption feed updates as the video plays, and **Analyze video** returns up to five verified claims with a **TRUE / FALSE / UNCERTAIN** verdict, a short explanation, and sources. Click a result to seek the video to that moment.
- **On any page** — highlight a sentence, right-click **Fact-check with TruthCheck**, and get the same verdict in a floating card. No tab-switching.
- **Evidence before certainty** — every verdict is grounded in web search results, not the model's memory, and sources are always shown, never just asserted.
- **Pick a focus** — general claims, politics, science & health, economics, history, technology, or numbers & statistics, to narrow what gets checked.

## How it works

```
caption / selected text  →  extract fact-checkable claims  →  web search for evidence  →  verdict + sources
```

A small local backend handles extraction and verification (OpenAI's Responses API with built-in web search). The extension never talks to an LLM directly, and no API key ever touches the browser.

## Run it

Prerequisite: Node.js 18+. No npm packages required.

```bash
cp .env.example .env
npm run dev
```

Then load the extension:

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select the `extension` folder.
3. Open a YouTube video with captions on, or highlight text on any page and right-click **Fact-check with TruthCheck**.

It ships in **demo mode**: verdicts appear instantly with no API key, so a live demo never depends on a third-party API. Set `DEMO_MODE=false` and add `LLM_API_KEY` in `.env` for live analysis.
