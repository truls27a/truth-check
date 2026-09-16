You are my senior full-stack engineer and hackathon partner.

I have 30 minutes to build a working MVP. Optimize aggressively for a compelling demo and simplicity, not production-grade architecture.

# PRODUCT

Build a browser-based MVP called **TruthCheck**.

TruthCheck runs on YouTube videos and displays a small overlay/sidebar showing AI-verified claims made in the video.

The core pipeline is:

YouTube video
→ obtain transcript/captions
→ identify relevant factual statements
→ verify statements using web search
→ classify each statement
→ display verdict + short explanation in an overlay

The main user experience is:

**Verdict:** TRUE / FALSE / UNCERTAIN

**Explanation:** one or two concise sentences explaining why.

**Read more:** opt-in option to read a bit longer and nuanced explanation

The user should be able to watch a YouTube video while TruthCheck analyzes the statements being made. If the video is paused, the truth-checking should also be paused so that the viewer has time to review.

# VERY IMPORTANT HACKATHON PRIORITIES

1. Get one complete end-to-end path working as quickly as possible.
2. Prefer captions/transcript over speech-to-text.
3. Do NOT build authentication unless absolutely necessary.
4. Do NOT build a database unless absolutely necessary.
5. Do NOT build a complex distributed architecture.
6. Do NOT over-engineer.
7. Use APIs/libraries that can be configured with environment variables.
8. Build graceful fallbacks when transcript retrieval or web verification fails.
9. Make the UI look polished enough for a live hackathon demo.
10. At the end, provide exact commands for running the project locally.

# TARGET PLATFORM

Build a **Chrome Extension using Manifest V3** plus a small backend API.

The extension should work on:

https://www.youtube.com/watch?v=...

The extension injects a TruthCheck panel into the YouTube page without replacing the video player.

# MVP EXPERIENCE

When the user opens YouTube:

1. The TruthCheck extension is active.

2. A small floating button appears in the lower/right area of the video/page.

3. Clicking it opens a right-side panel.

4. The panel contains:

   TruthCheck
   [Focus: dropdown]
   [Analyze video] button

5. The user selects a focus.

Initial focus presets:

* General factual claims
* Politics & current events
* Science & health
* Economics
* History
* Technology
* Numbers & statistics

Also provide:

* "All relevant claims"

The selected focus should affect which claims are extracted.

6. When "Analyze video" is clicked:

   * identify the current YouTube video ID
   * obtain transcript/captions
   * send transcript to backend
   * extract relevant factual claims
   * verify claims
   * return structured results
   * render results in the panel

7. Each result should contain:

   [TRUE]
   Claim text

   Short explanation.

   Sources:
   [source title]
   [source title]

8. Use visually distinct status indicators for TRUE / FALSE  / UNCERTAIN.

9. Clicking a claim should optionally expand:

   * exact claim
   * explanation
   * supporting/contradicting evidence
   * source links
   * approximate timestamp if available

# CLAIM EXTRACTION

Do NOT verify every sentence.

The first LLM step should identify only statements that are potentially fact-checkable and relevant to the selected focus.

For example:

Transcript:
"Inflation in Sweden reached 10% in 2022, which was the highest level in 30 years."

Possible extracted claims:

1. "Inflation in Sweden reached approximately 10% in 2022."
2. "This was the highest Swedish inflation rate in 30 years."

Ignore:

* opinions
* rhetorical statements
* jokes
* predictions
* subjective judgments
* vague claims that cannot realistically be verified
* purely conversational filler

Each extracted claim should have:

{
"id": string,
"claim": string,
"timestamp": number | null,
"relevance": number,
"factCheckability": number,
"category": string
}

Prefer fewer high-quality claims over many mediocre ones.

# VERIFICATION

For each extracted claim:

1. Search the web for evidence.
2. Prefer authoritative sources.
3. Use multiple sources when possible.
4. Determine whether the evidence supports or contradicts the claim.
5. Return one of:

TRUE
FALSE
UNCERTAIN

Definitions:

TRUE:
The available evidence strongly supports the claim as stated.

FALSE:
The available evidence strongly contradicts the claim as stated.

UNCERTAIN:
There is insufficient reliable evidence to confidently determine the truth.

IMPORTANT:
Do not pretend certainty when evidence is weak.

The model must distinguish:

* fact
* interpretation
* causal claim
* prediction
* opinion

Only factual/verifiable statements should normally reach the final verification stage.

# VERIFICATION OUTPUT

Use a structured JSON response similar to:

{
"claims": [
{
"id": "claim-1",
"claim": "...",
"verdict": "TRUE",
"confidence": 0.91,
"explanation": "...",
"timestamp": 134.2,
"sources": [
{
"title": "...",
"url": "...",
"publisher": "..."
}
]
}
]
}

# TRANSCRIPT STRATEGY

Prefer transcript/captions.

Implement the transcript layer behind a clean interface:

getYouTubeTranscript(videoId)

Try the simplest viable approach first.

Because arbitrary YouTube caption access may be difficult, design this as a replaceable adapter:

TranscriptProvider
├── YouTube transcript provider
└── optional fallback provider

Do NOT let transcript retrieval complexity block the rest of the application.

For the hackathon, it is acceptable to support:

* manually supplied transcript text as a fallback
* a small test transcript
* a limited set of caption retrieval techniques

The UI should clearly show:

"Transcript unavailable — paste transcript to analyze"

when necessary.

# ARCHITECTURE

Use a simple structure such as:

TruthCheck/
extension/
manifest.json
content.js
styles.css
panel.js
server/
index.js
services/
transcript.js
claims.js
verify.js
search.js
shared/
types.js
.env.example
README.md

Use JavaScript or TypeScript.

Prefer TypeScript if setup is quick. Otherwise use JavaScript.

Use a minimal backend, for example:

* Node.js
* Express

Do not introduce a large framework unless it materially accelerates implementation.

# LLM

Use an LLM API through environment variables.

Create a small abstraction:

llm.generateStructured(...)

so that the model provider can be swapped easily.

The backend should have two logical LLM stages:

1. Claim extraction
2. Verification synthesis

Do not make the frontend call the LLM directly.

# WEB SEARCH

Create a search abstraction:

searchWeb(query)

Use whatever web-search provider is easiest to configure and works reliably in the hackathon environment.

The verification process should:

* generate search queries from the claim
* retrieve several results
* extract useful snippets/content
* ask the LLM to reason over the evidence
* return verdict + explanation + sources

Favor primary sources such as:

* government websites
* official statistics
* universities
* scientific organizations
* reputable news organizations
* original studies
* company/organization documentation when relevant

# IMPORTANT ANTI-HALLUCINATION RULE

The verifier must not decide based only on the model's internal knowledge.

The final explanation should be grounded in retrieved evidence.

Include an evidence trace internally such as:

{
"supportingEvidence": [...],
"contradictingEvidence": [...]
}

Then generate the final concise explanation from that evidence.

# CURRENT VIDEO

The extension must detect the YouTube video ID from the current page.

Handle navigation between YouTube videos without requiring a full browser refresh.

Watch for YouTube SPA navigation changes.

When the video changes:

* clear old analysis
* update video ID
* update UI state

# TIMESTAMPS

Where possible, associate claims with transcript timestamps.

Store:

startTimeSeconds

When a user clicks a claim, optionally seek the YouTube video to that timestamp.

This is desirable but lower priority than getting analysis working.

# UI

Make the TruthCheck panel visually polished but extremely simple.

Suggested layout:

---

TruthCheck
Verify claims as you watch

Focus
[ General factual claims ▼ ]

[ Analyze video ]

---

Analysis

✓ TRUE
"Earth's average surface temperature
has increased..."

Strong evidence supports this claim.

Sources
• NASA
• NOAA

---

! UNCERTAIN
"..."

Explanation...

Sources
• ...

---

✕ FALSE
"..."

Explanation...

Sources
• ...
-----

Use:

* compact typography
* rounded cards
* subtle shadows
* clear status labels
* loading indicators
* skeleton/loading state
* error state
* empty state

The panel should feel like a modern AI browser tool.

# LIVE ANALYSIS MODE

For the MVP, full real-time streaming verification is NOT required.

Instead, clicking "Analyze video" can analyze the transcript and return a batch of claims.

However, structure the code so that real-time analysis can later be added.

Create a clear future interface such as:

analyzeTranscript(transcript, focus)

and keep UI rendering independent from where the claims came from.

# PERFORMANCE

Do not verify dozens of claims.

For the MVP:

* extract at most 5-8 claims
* verify at most 5 claims

This keeps API cost and latency manageable.

# FOCUS PRESETS

Represent presets as configuration rather than hard-coded branching.

Example:

{
"general": {
"name": "General factual claims",
"instruction": "Identify important factual claims..."
},
"politics": {
"name": "Politics & current events",
"instruction": "Prioritize claims about..."
}
}

Add:

* General factual claims
* Politics & current events
* Science & health
* Economics
* History
* Technology
* Numbers & statistics
* All relevant claims

# SECURITY

Never expose API keys in the browser extension.

All LLM/search requests go through the backend.

Use environment variables.

Add .env.example:

LLM_API_KEY=
SEARCH_API_KEY=

The exact variable names can be adapted to the chosen providers.

# ERROR HANDLING

The application should never crash because:

* transcript unavailable
* search unavailable
* LLM timeout
* malformed model response
* invalid YouTube URL

Return useful UI messages.

For example:

"Couldn't retrieve captions for this video."

"Verification service unavailable."

"No fact-checkable statements found."

"Some claims could not be verified."

# DEMO MODE

Create a demo mode that guarantees a successful presentation.

Add:

DEMO_MODE=true

When demo mode is enabled:

* the app can use a bundled example transcript
* it can return a small set of realistic example claims
* it can show example verification results

This is extremely important because this is a 30-minute hackathon and external APIs may fail.

The normal flow should still be implemented, but the demo must be reliable.

# DEVELOPMENT EXPERIENCE

Create a README with:

1. prerequisites
2. installation
3. environment variables
4. starting backend
5. loading the Chrome extension
6. opening YouTube
7. testing
8. enabling demo mode

Include exact commands.

For example:

npm install
npm run dev

Then explain how to load the extension through:

chrome://extensions

with Developer Mode and "Load unpacked".

# TESTING

Create at least a few lightweight tests for:

* extracting YouTube video ID
* parsing model JSON
* verdict validation
* focus preset selection

Do not spend excessive time on tests.

# CODING STYLE

Keep the code:

* readable
* small
* modular
* easy to modify live during a hackathon

Avoid:

* unnecessary abstractions
* microservices
* Docker unless needed
* databases
* authentication
* complex state management
* elaborate build systems

# CRITICAL EXECUTION INSTRUCTION

Do not merely describe the architecture.

Actually build the project.

Start by inspecting the current directory.

Then:

1. Create the project structure.
2. Implement the backend.
3. Implement claim extraction.
4. Implement verification.
5. Implement transcript retrieval/fallback.
6. Implement Chrome extension UI.
7. Implement YouTube integration.
8. Implement demo mode.
9. Test the complete flow.
10. Fix obvious errors.
11. Give me concise instructions for running it.

When you encounter a choice, prefer the option that gets a functioning demo in the fewest steps.

If a particular external API is unavailable or difficult to access, do not get stuck. Replace it with the simplest viable implementation or fallback while preserving the architecture.

# DEFINITION OF DONE

The project is done when I can:

1. start the backend
2. load the Chrome extension
3. open a YouTube video
4. click TruthCheck
5. choose "General factual claims"
6. click "Analyze video"
7. see several claims
8. see TRUE/FALSE/UNCERTAIN verdicts
9. see a short explanation
10. see clickable source links
11. optionally click a claim and jump to its timestamp
12. run the whole demo without manually editing source code

Build the MVP now. Also tell me how to test and get this running ASAP for the demo.