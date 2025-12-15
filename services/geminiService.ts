import { GoogleGenAI } from "@google/genai";

// Ensure API Key is available
const apiKey = process.env.API_KEY || '';

/**
 * Creates a new Gemini Client. 
 */
const getClient = () => new GoogleGenAI({ apiKey });

// Helper to check for paid key requirement
export const checkApiKeySelection = async (): Promise<boolean> => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.hasSelectedApiKey) {
     return await window.aistudio.hasSelectedApiKey();
  }
  return true; 
};

export const openApiKeySelection = async () => {
  if (typeof window.aistudio !== 'undefined' && window.aistudio.openSelectKey) {
    await window.aistudio.openSelectKey();
  }
};

interface ImageGenerationOptions {
  aspectRatio?: string;
  resolution?: string; // '1K', '2K', '4K'
  numberOfImages?: number;
}

export const enhancePrompt = async (originalPrompt: string, type: 'image' | 'video' = 'image'): Promise<string> => {
  const ai = getClient();
  
  let instructions = "";
  
  if (type === 'image') {
      instructions = `You are an expert Director of Photography (DP) creating a shot list for a high-budget commercial. 
      Rewrite the following prompt to be a highly detailed, photorealistic image description. 
      
      CRITICAL: You MUST include specific technical details to achieve a "film look", such as:
      - Camera Bodies: e.g., Arri Alexa LF, RED V-RAPTOR, Sony Venice.
      - Lenses: e.g., Panavision C-Series Anamorphic, Canon K35, 85mm Prime.
      - Filters/Effects: e.g., Tiffen Black Pro-Mist 1/4, Cinebloom, Halation, Film Grain.
      - Lighting: e.g., Volumetric fog, Rembrandt lighting, Golden Hour, Chiaroscuro.
      
      Keep it under 70 words. Focus purely on the visual aesthetic and composition.
      
      Original prompt: "${originalPrompt}"`;
  } else {
      instructions = `You are an expert Film Director and Cinematographer. 
      Rewrite the following prompt to be a detailed scene description for an AI Video Generator (Veo).
      
      CRITICAL: Unlike an image, a video prompt MUST describe MOTION.
      1. CAMERA MOVEMENT: Explicitly describe the camera move (e.g., Slow Dolly In, Truck Left, Low Angle Tracking Shot, Aerial Drone Flyover, Handheld chaos).
      2. SUBJECT ACTION: Describe exactly how the subject moves (e.g., turning head to camera, running towards lens, rain falling).
      3. LOOK: Include cinematic lens details (e.g., Anamorphic flare, Shallow depth of field) but prioritize motion.
      
      Keep it under 70 words.
      
      Original prompt: "${originalPrompt}"`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: instructions,
  });
  return response.text?.trim() || originalPrompt;
};

export const generateImageFromText = async (prompt: string, options?: ImageGenerationOptions): Promise<string[]> => {
  const ai = getClient();
  
  const isHighQuality = options?.resolution === '2K' || options?.resolution === '4K';
  const model = isHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const count = options?.numberOfImages || 1;

  // Config construction
  const imageConfig: any = {
    aspectRatio: options?.aspectRatio || "1:1"
  };
  
  if (isHighQuality && options?.resolution) {
    imageConfig.imageSize = options.resolution;
  }

  // Enforce single image per request to prevent grids when user prompts for "4 images"
  // The system handles the count by making parallel requests.
  const refinedPrompt = `${prompt} . Do not generate a grid or collage. Generate a single high-quality image.`;

  // Create array of promises for parallel generation
  const promises = Array(count).fill(null).map(() => 
    ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: refinedPrompt }
        ]
      },
      config: {
        imageConfig: imageConfig
      }
    })
  );

  const responses = await Promise.all(promises);
  const imageUrls: string[] = [];

  for (const response of responses) {
      if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                imageUrls.push(`data:image/png;base64,${part.inlineData.data}`);
                break; // Only take the first valid image part from this response
            }
          }
      }
  }

  if (imageUrls.length === 0) {
      throw new Error("No image data found in responses");
  }

  return imageUrls;
};

export const generateImageFromImage = async (referenceImages: string[], prompt: string, options?: ImageGenerationOptions): Promise<string[]> => {
  const ai = getClient();
  
  const isHighQuality = options?.resolution === '2K' || options?.resolution === '4K';
  const model = isHighQuality ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  const count = options?.numberOfImages || 1;

  // Config construction
  const imageConfig: any = {
    aspectRatio: options?.aspectRatio || "1:1"
  };
  
  if (isHighQuality && options?.resolution) {
    imageConfig.imageSize = options.resolution;
  }

  const refinedPrompt = `${prompt} . Do not generate a grid or collage. Generate a single high-quality image.`;

  const parts: any[] = [];
  
  // Add images
  for (const img of referenceImages) {
      const cleanBase64 = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
      const mimeType = img.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
      parts.push({
          inlineData: {
              data: cleanBase64,
              mimeType: mimeType
          }
      });
  }

  // Add text prompt
  parts.push({ text: refinedPrompt });

  // Create array of promises for parallel generation
  const promises = Array(count).fill(null).map(() => 
      ai.models.generateContent({
        model: model,
        contents: {
          parts: parts
        },
        config: {
            imageConfig: imageConfig
        }
      })
  );

  const responses = await Promise.all(promises);
  const imageUrls: string[] = [];

  for (const response of responses) {
      if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                imageUrls.push(`data:image/png;base64,${part.inlineData.data}`);
                break;
            }
          }
      }
  }

  if (imageUrls.length === 0) {
      throw new Error("No image data found in responses");
  }

  return imageUrls;
};

export const generateVideo = async (prompt: string, inputImage?: string): Promise<string> => {
  // Re-instantiate to ensure we catch any updated key from window.aistudio
  const ai = getClient();

  const config: any = {
    numberOfVideos: 1,
    resolution: '720p',
    aspectRatio: '16:9'
  };

  const payload: any = {
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: config
  };

  // Add image if provided (Image-to-Video)
  if (inputImage) {
     const cleanBase64 = inputImage.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
     const mimeType = inputImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
     
     payload.image = {
        imageBytes: cleanBase64,
        mimeType: mimeType
     };
  }

  let operation = await ai.models.generateVideos(payload);

  // Polling loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  
  if (!downloadLink) {
    throw new Error("Video generation failed or no URI returned.");
  }

  // Fetch the actual video bytes using the API Key
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResponse.ok) {
     throw new Error("Failed to download generated video.");
  }
  
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};