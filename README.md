# OpenShield — AI-Powered Consumer Protection (Local Ollama `gemma3:1b` Edition)

**OpenShield** is a privacy-first consumer protection platform that inspects Terms & Conditions, privacy policies, subscription agreements, uploaded PDF/image contracts, and live webpages for hidden fees, automatic renewal traps, cancellation restrictions, unfair arbitration clauses, and manipulative dark patterns.

---

## 1. Why OpenShield Uses Local AI (`Ollama` + `gemma3:1b`)

In compliance with course and privacy requirements, **OpenShield does NOT use any external or paid cloud AI APIs** (no OpenAI, Gemini, Anthropic, Groq, or paid cloud keys).

Instead, OpenShield runs AI inference **100% locally on your own computer** using:
- **Local AI Runtime:** [Ollama](https://ollama.com)
- **Model:** `gemma3:1b`
- **Local Server Address:** `http://localhost:11434`
- **Chat Endpoint:** `POST http://localhost:11434/api/chat`
- **Model Health Endpoint:** `GET http://localhost:11434/api/tags`

### Why `http://localhost:11434` Is Allowed (Local vs. External API)
`localhost` (`127.0.0.1`) refers to the loopback network interface on **your own computer**. When OpenShield's Express backend (`server.ts`) sends a request to `http://localhost:11434/api/chat`, the data never leaves your machine, never crosses the public internet to a third-party AI vendor, and requires **zero API keys or paid subscriptions**.

---

## 2. Exact Windows PowerShell Setup Commands

Before running AI analysis in OpenShield on Windows, open **Windows PowerShell** and run the following four commands in order:

### Step 1 — Install Ollama on Windows
```powershell
irm https://ollama.com/install.ps1 | iex
```

### Step 2 — Verify Ollama Is Installed
```powershell
ollama --version
```

### Step 3 — Download the `gemma3:1b` Model
```powershell
ollama pull gemma3:1b
```

### Step 4 — Run the `gemma3:1b` Model Locally
```powershell
ollama run gemma3:1b
```
*(Once `ollama run gemma3:1b` starts, Ollama's local server is active on `http://localhost:11434`. You can type `/bye` to exit the interactive prompt while keeping the background Ollama service running, or leave the terminal open.)*

---

## 3. Running the OpenShield Project Locally

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```
2. **Optional environment configuration (`.env`):**
   Copy `.env.example` to `.env` if you want to customize the local port or model name (defaults work out of the box):
   ```env
   OLLAMA_BASE_URL="http://localhost:11434"
   OLLAMA_MODEL="gemma3:1b"
   APP_URL="http://localhost:3000"
   ```
3. **Start the OpenShield full-stack server:**
   ```bash
   npm run dev
   ```
4. **Open OpenShield in your browser:**
   Navigate to `http://localhost:3000`.
5. **Check the Local AI Status Banner:**
   At the top of the **Analyze** section, OpenShield displays a live status badge:
   - **"Local AI ready"** — Connected to `http://localhost:11434` with `gemma3:1b` installed.
   - **"Model gemma3:1b not installed"** — Ollama is running, but you need to run `ollama pull gemma3:1b`.
   - **"Ollama is not running"** — Start Ollama and run `ollama run gemma3:1b`, then click **Retry connection**.

---

## 4. Architecture & Data Flow

```text
+-----------------------------------------------------------------------+
|                         Browser Frontend (React)                      |
|  - URL & Policy Text Analyzer (#analyze-link)                         |
|  - PDF / Image / Text & Policy Diff Analyzer (#upload-document)       |
|  - LocalAiStatusBanner ("Local AI ready" / "Ollama is not running")   |
|  - ListenToResultsPanel (Browser-native window.speechSynthesis TTS)   |
+-----------------------------------+-----------------------------------+
                                    |
                                    | HTTP (/api/* on localhost:3000)
                                    v
+-----------------------------------------------------------------------+
|                     Express Backend (server.ts)                       |
|  - GET  /api/ollama/status    -> Checks GET localhost:11434/api/tags  |
|  - POST /api/ollama/analyze   -> Direct local gemma3:1b inference     |
|  - POST /api/extract-document -> Local PDF/Image text extraction      |
|  - POST /api/analyze          -> Hybrid Ollama + 17-Rule URL/Text     |
|  - POST /api/analyze-document -> Hybrid Ollama + 17-Rule Document     |
+-----------------+-----------------------------------+-----------------+
                  |                                   |
                  v                                   v
+-----------------------------------+   +-------------------------------+
|   Local Ollama Server (:11434)    |   | Deterministic 17-Rule Engine  |
|   POST /api/chat (gemma3:1b)      |   | (shared/rules/engine.ts)      |
|   - <UNTRUSTED_CONTRACT_DOCUMENT> |   | - Verbatim quote verification |
|   - JSON schema validation        |   | - Hidden Cost Calculator      |
|   - Hallucination guard           |   | - Prioritized Action Plan     |
+-----------------------------------+   +-------------------------------+
```

---

## 5. Key Features

### A. Evidence-First Hybrid Analysis (`gemma3:1b` + 17 Open-Source Rules)
- Evaluates agreements across 8 core consumer risk areas:
  1. Hidden fees and unexpected charges
  2. Automatic subscription renewals
  3. Cancellation restrictions and non-refundable terms
  4. Privacy and personal-data sharing/selling risks
  5. Broad or potentially unfair clauses (unilateral changes, perpetual content licenses)
  6. Misleading wording and dark patterns (trial conversions, confirm-shaming)
  7. Unusual penalties and liability limitations
  8. Forced arbitration and class-action waivers
- **Zero Fabricated Quotes:** Every finding returned by `gemma3:1b` is verified against the actual source text before being displayed.
- **Prompt-Injection Defense:** Uploaded or pasted contract text is sanitized for override phrases and enclosed inside `<UNTRUSTED_CONTRACT_DOCUMENT>...</UNTRUSTED_CONTRACT_DOCUMENT>` tags so adversarial text inside a contract cannot hijack the model.

### B. Local Document Upload & Text Review (`PDF`, `PNG/JPG/WebP`, `Text`, `Compare`)
- Validates file extensions, magic bytes, and a 10 MB size limit.
- Extracts text locally in memory and discards raw file buffers immediately after extraction.
- Includes a **"Review extracted text first"** button on uploaded PDFs and images so you can inspect or edit the extracted text before sending it to `gemma3:1b`.

### C. "Listen to Results" Browser Speech Feature
- Uses the browser's built-in Web Speech API (`window.speechSynthesis` / `SpeechSynthesisUtterance`)—no paid external text-to-speech API required.
- Includes **Listen to Summary**, **Read All Findings**, **Pause / Resume**, **Stop**, **Speed (`0.75x` – `1.5x`)**, **Voice selector**, and active card highlighting as each finding is read aloud.

---

## 6. How to Back Up Your Project Before Making Changes

Before making future edits, create a timestamped backup copy of your project folder in Windows PowerShell:

```powershell
# Navigate to the parent folder containing your OpenShield project
cd ..

# Create a timestamped ZIP backup (excluding node_modules and dist)
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
Compress-Archive -Path ".\OpenShield\*" -DestinationPath ".\OpenShield_Backup_$timestamp.zip" -Force
```

---

## 7. How to Save & Push Your Updated Project to a Private GitHub Repository

### Step 1 — Verify `.gitignore` Safety
Before committing, confirm that `.env`, `node_modules/`, and `dist/` are ignored:
```powershell
git status
```
Ensure `.env` never appears in untracked or staged files.

### Step 2 — Commit Your Changes Locally
```powershell
git init
git add .
git commit -m "Integrate local Ollama gemma3:1b AI analyzer, status banner, and local document extraction"
```

### Step 3 — Create a Private Repository on GitHub & Push
1. Go to [https://github.com/new](https://github.com/new).
2. Enter a repository name (for example, `openshield-local-ai`).
3. Select **Private** (so your academic project is visible only to you and anyone you invite).
4. Do **not** check "Add a README file" (your project already has one). Click **Create repository**.
5. Run these commands in PowerShell (replace `<YOUR_GITHUB_USERNAME>` with your GitHub username):
   ```powershell
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/openshield-local-ai.git
   git push -u origin main
   ```

---

## 8. Important Note on Localhost Deployment vs. Cloud Hosting

- **Classroom & Local Laptop Demonstrations (`http://localhost:3000`):** When you run OpenShield on your own Windows computer alongside `ollama run gemma3:1b`, the Express backend at `http://localhost:3000` connects directly to `http://localhost:11434`. Everything runs 100% locally and offline-capable.
- **Why Public Static/Cloud Hosting Cannot Reach Your Local Ollama:** If you deploy only the web app to a remote cloud server (such as Vercel, Render, or Cloud Run), that remote server's `localhost:11434` refers to the cloud container itself—not your personal Windows laptop. When Ollama is not running on the server host, OpenShield transparently reports **"Local AI (gemma3:1b) Unavailable — Showing Deterministic Rule Engine Results Only"** and never pretends that AI inference ran.

---

## 9. Running Automated Tests

Run the unit and integration test suite at any time with:

```bash
npm test
```
