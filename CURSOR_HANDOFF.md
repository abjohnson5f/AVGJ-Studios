# Cursor Agent Handoff & Context

**Start Here:** This document contains the architectural context, business logic, and future migration plans for "StoryBoard AI Studio". Use this file to ground your understanding before making changes.

---

## 1. Core Concept & Business Logic
We are building a **Digital Asset Management (DAM)** tool similar to Frame.io, but for AI Generation.
*   **Hierarchy:** Users create `Projects`. Projects contain `Scenes`. Scenes contain `Assets` (Images/Videos).
*   **Workflow:** User creates a scene -> Generates Images -> Selects best Image -> Animates it into Video (Veo) -> Downloads/Saves.
*   **Aesthetic:** Dark mode, professional, "Hollywood" feel. High contrast, subtle borders (`border-border`), minimal distractions.

## 2. Current Architecture (Prototype)
*   **State:** Currently client-side only using `React.useState` and `localStorage`.
*   **Files:**
    *   `types.ts`: The source of truth for data models (`Project`, `Scene`, `Asset`).
    *   `services/geminiService.ts`: Handles all API calls. Contains the prompt engineering logic.
    *   `components/Generator.tsx`: The main UI for creating assets. Handles the complexity of key selection and config (aspect ratio, resolution).
    *   `App.tsx`: Handles routing (via `ViewState`), layout, and data persistence.

## 3. Critical AI Implementation Details (DO NOT BREAK)

### A. The "Magic Enhance" Prompt Engineering
Located in `services/geminiService.ts` -> `enhancePrompt`.
*   We use **two distinct system prompts** based on the generation type.
*   **Image Mode:** Instructions focus on *Texture, Lighting, Camera Gear* (e.g., "Arri Alexa", "Tiffen Black Pro-Mist").
*   **Video Mode:** Instructions focus strictly on *Motion* (e.g., "Slow Dolly In", "Tracking Shot").
*   **Why:** Veo (Video model) fails if the prompt is too static. It needs motion verbs.

### B. Veo Video Generation
*   **Model:** `veo-3.1-fast-generate-preview`.
*   **Polling:** Video generation is async. We poll `ai.operations.getVideosOperation` every 5 seconds.
*   **Billing:** Veo requires a specific paid API key. We use `window.aistudio.openSelectKey()` to handle this in the prototype environment.

### C. Image Generation
*   **Models:** 
    *   Standard: `gemini-2.5-flash-image`
    *   High-Res (2K/4K): `gemini-3-pro-image-preview`
*   **Grid vs Single:** We force the model to generate single images (no grids) to maintain high fidelity for storyboarding.

## 4. Migration Plan: "The Neon Stack"
We are moving away from `localStorage`. Future tasks will involve porting this app to the following stack.

**Target Stack:**
*   **Framework:** Next.js 15 (App Router).
*   **Database:** **Neon** (Serverless Postgres).
*   **ORM:** **Drizzle**.
*   **Auth:** **Clerk**.
*   **File Storage:** **Cloudflare R2** or UploadThing.

**Migration Instructions for Agent:**
1.  **Schema Generation:** When asked to migrate, map `types.ts` directly to a Drizzle Schema.
    *   `Project` -> `projects` table.
    *   `Scene` -> `scenes` table (foreign key to projects).
    *   `Asset` -> `assets` table (foreign key to scenes, store `r2_url` instead of base64).
2.  **API Routes:** Move `geminiService.ts` logic into Server Actions (`"use server"`).
    *   *Reason:* Protect API keys and handle long-running Veo jobs via webhooks or background workers if possible.
3.  **Realtime:** When integrating Neon/Drizzle, ensure we implement optimistic UI updates so the app feels as fast as the local version.

## 5. Known Limitations / TODOs
*   **Data Limit:** `localStorage` has a 5MB-10MB limit. Generating too many videos will crash the current app. Migration to Neon/R2 is high priority.
*   **Uploads:** Currently, uploads are converted to Base64 strings. This is bad for performance. Needs to move to actual file upload (S3/R2).
*   **Context Window:** The chat history for "Magic Enhance" is currently single-turn. Future version should remember previous stylistic choices.

## 6. Style Guidelines
*   **Colors:** Use the defined `tailwind.config` colors:
    *   Background: `#0f0f11`
    *   Surface: `#18181b`
    *   Primary: `#6366f1` (Indigo)
*   **UI Components:** Keep the "Frame.io" look—dense information density, dark backgrounds, small crisp fonts.

---
**Agent Note:** When writing code, prefer **Typescript strict mode**. Do not hallucinate imports from `@google/genai`—check the imported version (v1.33.0) patterns in `geminiService.ts` first.
