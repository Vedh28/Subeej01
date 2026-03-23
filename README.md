# Subeej AI

Subeej AI is an agriculture intelligence platform built to help users make practical decisions around crop selection, seed choice, soil suitability, field conditions, and yield guidance. It combines a web interface, dataset-driven recommendation logic, and an LLM-powered assistant to deliver responses that are more useful than a generic chatbot.

The application is designed for agriculture-focused conversations. Instead of only generating text, it interprets user intent, extracts field details, grounds responses in available data, and returns actionable guidance through a structured workflow.

## What This Project Does

- Recommends crops and seeds based on field and location context
- Checks soil and season suitability for farming decisions
- Supports agriculture chat workflows with grounded responses
- Provides field and image-related intelligence features
- Supports local Ollama and cloud-hosted LLM providers including Hugging Face and Mistral

## Core Highlights

- Built with Next.js, React, and TypeScript
- Agriculture-focused conversational assistant
- Dataset-backed recommendation pipeline
- Modular API and library structure
- Deployable split architecture for Netlify frontend, Railway backend, and Hugging Face LLM

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts
- Leaflet
- Three.js

### AI and Backend Logic

- Hugging Face Inference API support
- Optional Mistral API fallback/provider support
- Ollama for local model serving
- Custom recommendation engine in `lib/`
- Python utilities for training and data-processing workflows

## How It Works

1. The user interacts with the web interface.
2. The backend identifies the user intent such as crop recommendation, soil suitability, or seed guidance.
3. The system extracts useful field details from the prompt.
4. Dataset context and rule-based logic are combined with the LLM call.
5. The application returns a grounded answer with better structure and relevance.

## Project Structure

```text
Subeej-demo/
├─ frontend/              Next.js app source
│  ├─ components/         Reusable UI blocks for chat, maps, dashboards, and field views
│  ├─ pages/              Frontend routes and legacy in-app API endpoints
│  ├─ public/             Static assets such as maps and generated CSS
│  ├─ styles/             Global styling
│  ├─ .env.local.example  Frontend and shared local environment template
│  └─ next.config.js      Frontend Next.js configuration
├─ backend/               Express API service for split deployments
├─ database/
│  └─ source/             Agriculture dataset used for recommendation grounding
├─ lib/                   Core business logic, LLM client, prompts, and recommendation engine
├─ outputs/               Ollama model definition and model-related generated assets
├─ scripts/               Development, build, export, and training helper scripts
├─ seed-intelligence-ai/  Python-side AI pipeline, training, vector store, and RAG utilities
├─ .env.railway.example   Backend deployment environment template
├─ launch-subeej.cmd      Windows launcher for the packaged app
├─ package.json           Node scripts and dependency manifest
└─ README.md              Project overview and setup guide
```

## Main Directories Explained

### `frontend/`

Contains the Next.js application, including routes, UI components, static assets, styles, and the frontend-local environment template.

### `backend/`

Contains the Railway-ready Express API service for chat, recommendation, field analysis, map data, and seed visuals.

### `database/`

Contains the dataset files used for recommendation grounding and field intelligence lookups.

### `lib/`

Contains the main application logic, including:

- LLM provider integration
- prompt construction
- recommendation logic
- dataset grounding
- chat orchestration

### `scripts/`

Contains support scripts for:

- development startup
- clean builds
- training data preparation
- Ollama export workflows

### `seed-intelligence-ai/`

Contains the Python-side experimentation and AI pipeline, including dataset loading, training helpers, vector store logic, and retrieval-related utilities.

## Local Setup

### Prerequisites

- Node.js installed
- npm installed
- Ollama installed only if you want local model inference instead of Hugging Face or Mistral

### Installation

```bash
npm install
```

### Environment Setup

Create a local environment file from the example:

```bash
cp frontend/.env.local.example frontend/.env.local
```

Then update values as needed for your setup.

### Run Frontend in Development

```bash
npm run dev
```

### Run Railway Backend in Development

```bash
npm run backend:dev
```

### Run Production Build

```bash
npm run build
npm run start
```

## Environment Notes

The project supports three LLM execution styles:

- Hugging Face Inference API
- Ollama for local model execution
- Mistral API for optional cloud-based inference

Typical environment values include:

- `NEXT_PUBLIC_API_BASE_URL`
- `FRONTEND_ORIGIN`
- `LLM_PROVIDER`
- `HUGGINGFACE_API_KEY` or `HF_TOKEN`
- `HUGGINGFACE_MODEL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MISTRAL_API_KEY`
- `MISTRAL_MODEL`

### Recommended Deployment Split

- Netlify: deploy the Next.js frontend from the repo root
- Railway: deploy the Express API using `npm run backend:start`
- Hugging Face: host the LLM behind the Inference API used by the Railway backend

Use these files as a guide:

- `frontend/.env.netlify.example` for Netlify environment variables
- `.env.railway.example` for Railway environment variables
- `netlify.toml` for Netlify build settings
- `railway.json` for Railway start and healthcheck settings

For this deployment target, set:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-railway-backend.up.railway.app
```

on Netlify, and set:

```env
FRONTEND_ORIGIN=https://your-netlify-site.netlify.app
LLM_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your_huggingface_token
HUGGINGFACE_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

on Railway.

### Hugging Face Integration

If you want Hugging Face as the primary provider:

```env
LLM_PROVIDER=huggingface
LLM_FALLBACK_PROVIDER=
HUGGINGFACE_API_KEY=your_huggingface_token
HUGGINGFACE_MODEL=meta-llama/Llama-3.1-8B-Instruct
HUGGINGFACE_BASE_URL=https://router.huggingface.co/v1
```

### Mistral API Integration

If you want to use Mistral directly, add your key in `frontend/.env.local` and switch the provider:

```env
LLM_PROVIDER=mistral_api
LLM_FALLBACK_PROVIDER=
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-latest
MISTRAL_BASE_URL=https://api.mistral.ai/v1
```

If you want Ollama as primary and Mistral as fallback:

```env
LLM_PROVIDER=ollama
LLM_FALLBACK_PROVIDER=mistral_api
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-latest
```

After updating `frontend/.env.local`, restart the app and verify provider status at `/api/llm/health`.

## Repository Notes

- Large generated files are excluded from GitHub
- Local model binaries such as `.gguf` files are not committed
- `.env.local` is ignored to avoid leaking local secrets
- The repository is structured for source code, not packaged binary distribution

## Summary

Subeej AI is a structured agriculture decision-support system, not just a chatbot. It combines a modern web app, recommendation logic, and LLM-based reasoning to give users more relevant and grounded farming guidance.
