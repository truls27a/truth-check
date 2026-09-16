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

Extraction and verification run on the [TruthCheck website](https://truth-check-tool.lovable.app), behind your TruthCheck account. The extension never talks to an LLM directly and holds no API keys: it only sends your sign-in token, and only to TruthCheck.

## Install

1. **Clone** this repo: `git clone https://github.com/truthcheck/truthcheck.git`
2. Open **`chrome://extensions`**, turn on **Developer mode**, click **Load unpacked**, and select the `extension` folder.
3. Click the TruthCheck icon in the toolbar and **sign in** with your TruthCheck account. Your plan (Free or Pro) carries over automatically.

Then open a YouTube video with captions on, or highlight text on any page and right-click **Fact-check with TruthCheck**. On YouTube, open the full panel from the toolbar popup.

No account yet? [Create one on the website](https://truth-check-tool.lovable.app).

## Plans

- **Free** — 10 checks a day (selected text and video analysis), plus 40 live-caption checks a day.
- **Pro** — unlimited checks, documents and PDFs, deeper evidence, and full history. [See pricing](https://truth-check-tool.lovable.app/pricing).

Limits are enforced by the website. When the free allowance runs out, TruthCheck says so in the card and links to Pro.

## Development

There is no build step. The extension is plain JavaScript loaded directly by `extension/manifest.json`; after editing, reload it in `chrome://extensions`. Website and Supabase settings live in `extension/config.js`.

```bash
npm test   # Node 18+; no dependencies
```
