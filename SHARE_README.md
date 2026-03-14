Subeej share package

Requirements
- Windows
- Node.js installed
- Ollama installed

First-time setup on another system
1. Extract the ZIP.
2. Open the extracted folder.
3. Run `setup-ollama-model.cmd` once to register the bundled fine-tuned model in Ollama.
4. Run `launch-subeej.cmd`.
5. Do not start the app with `npm start` directly from the share package.
6. Open `http://localhost:5173/chat` if the browser does not open automatically.

Included in this package
- Packaged Next.js build in `next-build/`
- `node_modules`
- Dataset CSV in `data/source/`
- Fine-tuned GGUF model in `outputs/`

Notes
- The packaged `.env.local` is safe for sharing and uses the bundled dataset plus local Ollama model.
- If Ollama is not running, start Ollama and rerun `setup-ollama-model.cmd`.
