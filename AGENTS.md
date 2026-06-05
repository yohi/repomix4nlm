# AGENTS.md

## Project Context

This is a wrapper CLI tool (`repomix-nlm-splitter`) designed to automatically clone large Git repositories, measure their file word counts, and slice them into structured, directory-respecting chunks. The outputs are saved as Repomix XML-styled `.txt` files compatible with NotebookLM.

### Purpose (WHY)
AI context and token limits (such as NotebookLM's ~500,000 word safety threshold) prevent importing massive repositories directly. This tool automates intelligent greedy bin-packing and ensures large codebases are split into readable segments without losing directory hierarchy context.

---

## Tech Stack & Setup (WHAT)

- **Runtime & Compilation**: Node.js >= 22.0.0, TypeScript (ESM, NodeNext)
- **Key Dependencies**: `repomix` (core pack & search), `git-url-parse` (remote URL analysis)
- **Package Manager**: npm (Standard workspace)

---

## How to Verify Changes (HOW)

Agents must use the following commands to build, test, and typecheck code changes:

- **Install Dependencies**: `npm install`
- **Build Project**: `npm run build` (transpiles TS in `src/` to JS in `dist/`)
- **Run Tests**: `npm test` (uses Vitest)
- **Typecheck**: `npm run typecheck` (verifies TypeScript compilation without emitting files)
- **Manual Smoke Run**: `node dist/index.js <git-url> --out-dir <dir>`

---

## Progressive Disclosure & Code Quality

- **Specifications**: For detailed design decisions, greedy bin-packing thresholds, file excludes, naming rules (such as `-chunkN` suffixes), and Git lifecycle/error handling, refer to [SPEC.md](./SPEC.md).
- **Style Guidelines**: Code style and typing are enforced programmatically. Use `npm run typecheck` and `npm test` to identify style or compile issues. Do not write extensive manual formatting rules here.
