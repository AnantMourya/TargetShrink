# 🎯 Target-Size Studio — All-in-One Media & Document Reducer

> **Hit the exact file size limit in KB or MB. Zero guessing. First try.**
> 100% In-Browser • Zero Server Uploads • Zero Bandwidth Costs • 100% Confidential & Private.
> Powered by WebAssembly FFmpeg (`@ffmpeg/ffmpeg`), PDF.js, PDF-Lib, jsPDF, Mammoth, and HTML5 Canvas API.

---

## 🛠️ The 4 Built-In Power Tools

### 1. 🎬 Video & GIF Shrinker
* **Reverse-Engineered Platform Limits**: Target exact upload ceilings for Discord Free (10 MB), Discord Nitro (25 MB), Slack Custom Emojis (sub-128 KB, 128×128 square), GitHub README assets (5 MB), and Email (20 MB).
* **Direct Custom Size**: Enter any exact number in **MB or KB**.
* **Smart BPP Heuristic**: Automatically scales resolution (1080p $\to$ 720p $\to$ 480p) and adjusts framerate to prevent pixelation/macroblocking.
* **Dual-Pass GIF Palettes**: Generates 256-color optimized palettes with Bayer dithering.
* **Synchronized Comparison**: Side-by-side video inspection player with synchronized scrub.

### 2. 🖼️ Image Size Reducer (Direct KB / MB Input)
* **Direct Target Size Input**: Specify exact desired file size (e.g. `50 KB`, `100 KB`, `200 KB`, `500 KB`, `1.5 MB`).
* **Binary Search Optimization Solver**: Iterates quality and dimensions to maximize sharpness while guaranteeing the file never breaches your ceiling.
* **Supports**: JPEG, PNG, WebP, AVIF.
* **Instant In-Browser**: Compresses in 50–200ms right on HTML5 Canvas.

### 3. 📄 PDF Size Reducer (Direct KB / MB Input)
* **Direct Target Size Input**: Specify exact maximum PDF size (e.g. `500 KB` for passport/visa portals, `1 MB` for job portals, `2 MB` for university assignments).
* **Dynamic Per-Page Budgeting**: Analyzes total page count and dynamically tunes DPI (200 $\to$ 150 $\to$ 120 $\to$ 96 DPI) and JPEG stream quality per page.
* **Guaranteed Portal Pass**: Strictly outputs under the threshold with zero loss of document structure.

### 4. 📑 PDF ⇄ Word Converter
* **PDF to Word (.docx)**: Extracts text, headings, paragraphs, and page breaks from PDF files into a standard Microsoft Word `.docx` file (OpenXML / JSZip).
* **Word (.docx) to PDF**: Converts `.docx` documents into clean, paginated, shareable PDF files using Mammoth and jsPDF.
* **Confidential & Offline**: Resumes, contracts, and IDs stay securely in browser memory.

---

## 💻 Quick Start & Running Locally

The local server delivers Cross-Origin Opener Policy (`COOP: same-origin`) and Cross-Origin Embedder Policy (`COEP: require-corp`) headers for WebAssembly multi-threading:

```bash
python server.py
# Or custom port:
python server.py 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in any modern browser.

---

## 📱 Mobile & Desktop Responsive
* Optimized for phones (320px–600px), tablets, and PC screens.
* Zero horizontal overflow or clipped panels.
* Fast offline execution with pre-cached local vendor bundles.
