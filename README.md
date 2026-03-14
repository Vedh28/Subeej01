# Subeej AI

Subeej AI is an agriculture intelligence web platform for crop recommendation, seed guidance, soil suitability checks, yield estimation, and field support. The project combines a Next.js frontend with dataset-grounded recommendation logic and an LLM-backed assistant.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Ollama
- Optional Mistral API integration

## Features

- Crop and seed recommendation workflows
- Soil and season suitability guidance
- Agriculture chat assistant
- Dataset-grounded responses
- Local LLM serving with Ollama

## Project Structure

- `pages/` API routes and Next.js pages
- `components/` UI components
- `lib/` chat orchestration, LLM client, recommendation logic, and utilities
- `data/` source dataset files
- `scripts/` development, build, and training helper scripts
- `seed-intelligence-ai/` Python-side AI and data-processing utilities

## Local Setup

1. Install Node.js and Ollama.
2. Run `npm install`.
3. Copy `.env.local.example` to `.env.local` and update values as needed.
4. Start the app with `npm run dev`.

## Notes

- Large generated assets and local model binaries are excluded from GitHub.
- The packaged Ollama model file should be distributed separately from the source repository.
