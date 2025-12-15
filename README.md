# StoryBoard AI Studio

A "Frame.io-inspired" digital asset management system specifically designed for AI-assisted storyboarding. This application allows Directors and Creatives to organize projects into scenes and generate high-fidelity assets (Images and Videos) using Google's Gemini and Veo models.

![Status](https://img.shields.io/badge/Status-Prototype-orange) ![Stack](https://img.shields.io/badge/Stack-React_|_Gemini_API-blue)

## 🌟 Key Features

*   **Project & Scene Management:** Organize assets hierarchically (`Project -> Scene -> Assets`).
*   **Multi-Model Generation:**
    *   **Text-to-Image:** Uses `gemini-2.5-flash-image` for speed and `gemini-3-pro-image-preview` for 2K/4K resolution.
    *   **Image-to-Image:** Maintain style consistency by referencing existing assets.
    *   **Text-to-Video:** Direct integration with **Veo** (`veo-3.1-fast-generate-preview`) for motion generation.
*   **Magic Enhance:** Context-aware prompt engineering that acts as a:
    *   **Director of Photography (DP):** For images (injects camera bodies, lenses, lighting).
    *   **Film Director:** For video (injects camera movement, blocking, and action).
*   **Asset Lightbox:** Full-screen preview with download and "Animate with Veo" workflow.
*   **Local Persistence:** Currently uses `localStorage` for zero-setup prototyping.

## 🛠️ Tech Stack (Current Prototype)

*   **Frontend:** React 19, TypeScript
*   **Styling:** Tailwind CSS (Custom dark mode palette)
*   **AI SDK:** `@google/genai` (Google Gen AI SDK)
*   **Icons:** Lucide-style SVG components

## 🚀 Getting Started

1.  **Clone the repository**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up API Key:**
    *   The app requires a Google Gemini API Key.
    *   *Note:* For Veo (Video) and High-Res generation, a **Paid Tier** key is required. The app includes a built-in key selector for AI Studio environments.
4.  **Run the dev server:**
    ```bash
    npm run dev
    ```

## 🧠 "Magic Enhance" Logic

The application relies heavily on specific system instructions to achieve a cinematic look.
*   **Images:** The AI is instructed to act as a DP using Arri Alexa/Sony Venice cameras and Anamorphic lenses.
*   **Videos:** The AI prioritizes **motion descriptions** (Dolly, Truck, Pan) over texture details to ensure Veo generates movement.

## 🔮 Future Roadmap (Migration Plan)

We are preparing to migrate this prototype to a production-ready stack:
*   **Framework:** Next.js 15 (App Router)
*   **Database:** Neon (Serverless Postgres)
*   **ORM:** Drizzle
*   **Auth:** Clerk
*   **Storage:** Cloudflare R2 (for large video assets)

## 📄 License

MIT
