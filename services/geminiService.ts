import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { StoryAnalysis, ModelConfig, StoryPolishResponse, Language } from "../types";

// --- Google Specific Helpers ---

const isAuthError = (e: any): boolean => {
  const msg = (e.message || e.toString()).toLowerCase();
  return (
      msg.includes("requested entity was not found") || 
      msg.includes("404") || 
      (e.status === "NOT_FOUND") ||
      (e.code === 404)
  );
};

const getGoogleClient = (apiKey?: string) => {
  // Use provided key, or fallback to environment/injected key
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("Google API Key is missing");
  return new GoogleGenAI({ apiKey: key });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

// --- Utilities ---

/**
 * Safely parses JSON from LLM output, handling markdown blocks, surrounding text, and common syntax errors.
 */
const safeJSONParse = <T>(text: string): T => {
    let cleaned = text.trim();
    
    // 1. Try to extract from markdown code blocks
    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        cleaned = markdownMatch[1].trim();
    }

    // 2. If content still doesn't look like pure JSON, try to find the JSON object/array boundaries
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    
    let start = -1;
    let end = -1;

    // Determine if it's likely an object or array and find outer bounds
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = lastBrace;
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
    }

    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1);
    }

    try {
        return JSON.parse(cleaned) as T;
    } catch (e) {
        // 3. Attempt to fix trailing commas (e.g. [ "a", "b", ] -> [ "a", "b" ])
        try {
            const fixed = cleaned.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(fixed) as T;
        } catch (e2) {
             console.error("Failed to parse JSON:", text);
             throw new Error("Failed to parse model response as JSON. The response might be incomplete or malformed.");
        }
    }
};

// --- Connection Testing ---

export const testModelConnection = async (config: ModelConfig): Promise<boolean> => {
    try {
        if (config.provider === 'google') {
            const ai = getGoogleClient(config.apiKey);
            // Simple generation to test key
            await ai.models.generateContent({
                model: config.textModel || "gemini-2.5-flash",
                contents: "Hello, are you there?",
            });
            return true;
        } else {
            const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
            const headers: Record<string, string> = {
                "Content-Type": "application/json"
            };
            if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
            
            const body = {
                model: config.textModel,
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 5
            };

            const res = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });

            if (!res.ok) throw new Error(res.statusText);
            return true;
        }
    } catch (e) {
        console.error("Connection Test Failed", e);
        return false;
    }
};

// --- Analysis Logic ---

const ANALYSIS_JSON_SCHEMA_OBJECT = {
    type: "object",
    properties: {
      title: { type: "string", description: "A creative, catchy title for the story based on its theme" },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", description: "Visual appearance description for image generation" },
          },
          required: ["name", "description"],
        },
      },
      scenes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "Detailed visual description of the location/setting" },
          },
          required: ["description"],
        },
      },
      props: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", description: "Visual description of the object" },
          },
          required: ["name", "description"],
        },
      },
      animals_plants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "description"],
        },
      },
      others: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "description"],
        },
      },
      plot_points: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "What happens in this part of the story" },
            suggested_visual: { type: "string", description: "Detailed video generation prompt including subject, setting, lighting, camera movement, and style" },
          },
          required: ["description", "suggested_visual"],
        },
      },
    },
    required: ["title", "characters", "scenes", "props", "animals_plants", "others", "plot_points"],
};

export const analyzeStory = async (storyText: string, config: ModelConfig, lang: Language = 'en'): Promise<StoryAnalysis> => {
  console.log(`[Analyze] Starting analysis with provider ${config.provider} in ${lang}...`);
  if (config.provider === 'google') {
    return analyzeStoryGoogle(storyText, config, lang);
  } else {
    return analyzeStoryOpenAICompatible(storyText, config, lang);
  }
};

const analyzeStoryGoogle = async (storyText: string, config: ModelConfig, lang: Language): Promise<StoryAnalysis> => {
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A creative, catchy title for the story based on its theme" },
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING, description: "Visual appearance description for image generation" },
              },
              required: ["name", "description"],
            },
          },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "Detailed visual description of the location/setting" },
              },
              required: ["description"],
            },
          },
          props: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING, description: "Visual description of the object" },
              },
              required: ["name", "description"],
            },
          },
          animals_plants: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["name", "description"],
            },
          },
          others: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["name", "description"],
            },
          },
          plot_points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "What happens in this part of the story" },
                suggested_visual: { type: Type.STRING, description: "Detailed video generation prompt including subject, setting, lighting, camera movement, and style" },
              },
              required: ["description", "suggested_visual"],
            },
          },
        },
        required: ["title", "characters", "scenes", "props", "animals_plants", "others", "plot_points"],
    };

    const langInstruction = lang === 'zh' 
        ? "IMPORTANT: All 'title', 'description' (for assets and plot_points), and 'name' fields MUST be in Chinese (Simplified). HOWEVER, the 'suggested_visual' field MUST remain in English to ensure better compatibility with video generation models." 
        : "Respond in English.";

    const prompt = `Analyze the following folktale. 
    1. Generate a creative, catchy title for the story.
    2. Extract characters, scenes, props, animals/plants, and key plot points. 
    For descriptions, ensure they are highly visual and suitable for an image generation prompt (e.g., 'Cinematic lighting, detailed texture').
    
    For the 'suggested_visual' field in plot_points, create a highly detailed prompt for video generation. It MUST include:
    - Detailed description of the visible action.
    - Visual appearance of characters and setting (referencing extracted assets where possible).
    - Lighting (e.g., 'golden hour', 'cinematic', 'dramatic').
    - Camera movement (e.g., 'slow pan', 'zoom', 'static shot').
    - Style (e.g., 'photorealistic', '8k', 'highly detailed', 'folklore style').

    ${langInstruction}

    Story: ${storyText}`;

    const attempt = async (isRetry: boolean): Promise<StoryAnalysis> => {
        const ai = getGoogleClient(config.apiKey);
        try {
            // Attempt 1: Strict JSON Schema Mode
            try {
                const response = await ai.models.generateContent({
                    model: config.textModel || "gemini-2.5-flash",
                    contents: prompt,
                    config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: config.inferenceConfig?.temperature,
                    topP: config.inferenceConfig?.topP,
                    maxOutputTokens: config.inferenceConfig?.maxTokens,
                    safetySettings: SAFETY_SETTINGS
                    },
                });
            
                const text = response.text;
                console.log("[Analyze] Google Response (Strict):", text?.substring(0, 100) + "...");
                if (!text) throw new Error("No analysis generated from Google. Content might be blocked.");
                return safeJSONParse<StoryAnalysis>(text);

            } catch (e: any) {
                if (isAuthError(e)) throw e; // Bubble up auth errors

                // Specifically catch the RPC/Schema errors and fallback
                console.warn("[Analyze] Strict schema generation failed, attempting fallback to prompt-based JSON...", e);

                // Attempt 2: Fallback to Prompt-based JSON (No Strict Schema)
                const response = await ai.models.generateContent({
                    model: config.textModel || "gemini-2.5-flash",
                    contents: `${prompt}\n\nIMPORTANT: Return the result as a valid JSON object matching this structure:\n${JSON.stringify(ANALYSIS_JSON_SCHEMA_OBJECT, null, 2)}`,
                    config: {
                        responseMimeType: "application/json",
                        temperature: config.inferenceConfig?.temperature,
                        topP: config.inferenceConfig?.topP,
                        maxOutputTokens: config.inferenceConfig?.maxTokens,
                        safetySettings: SAFETY_SETTINGS
                    },
                });

                const text = response.text;
                console.log("[Analyze] Google Response (Fallback):", text?.substring(0, 100) + "...");
                if (!text) throw new Error("No analysis generated from Google (Fallback).");
                return safeJSONParse<StoryAnalysis>(text);
            }
        } catch (error: any) {
             if (!isRetry && isAuthError(error) && window.aistudio) {
                 console.log("API Key entity not found. Prompting user to select key...");
                 await window.aistudio.openSelectKey();
                 return attempt(true);
             }
             console.error("[Analyze] Google Error:", error);
             throw error;
        }
    };
    
    return attempt(false);
};

const analyzeStoryOpenAICompatible = async (storyText: string, config: ModelConfig, lang: Language): Promise<StoryAnalysis> => {
    const langInstruction = lang === 'zh' 
        ? "All descriptions, titles, and names MUST be in Chinese (Simplified). The 'suggested_visual' field MUST be in English."
        : "";

    const messages = [
        {
            role: "system",
            content: `You are a story analysis assistant. Analyze the folktale provided. 
            1. Generate a creative, catchy title for the story.
            2. Extract characters, scenes, props, animals/plants, and key plot points.
            For descriptions, ensure they are highly visual and suitable for image generation.
            
            For the 'suggested_visual' field in plot_points, create a highly detailed prompt for video generation. It MUST include:
            - Detailed description of the visible action.
            - Visual appearance of characters and setting (referencing extracted assets where possible).
            - Lighting (e.g., 'cinematic', 'dramatic').
            - Camera movement (e.g., 'slow pan', 'zoom').
            - Style (e.g., 'photorealistic', '8k', 'folklore style').
            
            ${langInstruction}

            You MUST respond with valid JSON strictly matching this schema:
            ${JSON.stringify(ANALYSIS_JSON_SCHEMA_OBJECT)}
            `
        },
        {
            role: "user",
            content: storyText
        }
    ];

    const body: any = {
        model: config.textModel,
        messages: messages,
        temperature: config.inferenceConfig?.temperature,
        top_p: config.inferenceConfig?.topP,
        max_tokens: config.inferenceConfig?.maxTokens,
    };

    if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'volcengine' || config.provider === 'qwen') {
        if (config.provider === 'openai') {
             body.response_format = { type: "json_object" };
        }
    }
    if (config.provider === 'ollama') {
        body.format = "json";
        body.stream = false;
    }

    const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Model request failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("[Analyze] OpenAI Compatible Response:", content?.substring(0, 100) + "...");

    if (!content) throw new Error("Empty response from model");

    return safeJSONParse<StoryAnalysis>(content);
};


// --- Image Generation Logic ---

export const generateAssetImage = async (
    description: string, 
    context: string, 
    negativePrompt: string | undefined, 
    config: ModelConfig
): Promise<string> => {
  
  console.log(`[ImageGen] Generating: ${description}`);
  // Construct prompt
  let promptText = `High quality, cinematic, folklore style illustration of: ${description}. Context: ${context}. Detailed, 8k, masterpiece.`;
  if (negativePrompt && negativePrompt.trim()) {
    promptText += ` Ensure the image does not contain: ${negativePrompt}.`;
  }

  // Google Image Gen
  if (config.provider === 'google') {
      const attempt = async (isRetry: boolean): Promise<string> => {
          const ai = getGoogleClient(config.apiKey);
          const modelName = config.imageModel || "gemini-2.5-flash-image";

          try {
              if (modelName.toLowerCase().includes('imagen')) {
                 // Use generateImages for Imagen models
                 console.log(`[ImageGen] Using Imagen model: ${modelName}`);
                 const response = await ai.models.generateImages({
                    model: modelName,
                    prompt: promptText,
                    config: {
                      numberOfImages: 1,
                      outputMimeType: 'image/jpeg',
                      aspectRatio: '1:1',
                    },
                 });
                 
                 const b64 = response.generatedImages?.[0]?.image?.imageBytes;
                 if (b64) return `data:image/jpeg;base64,${b64}`;
                 throw new Error("No image data returned from Imagen.");

              } else {
                 // Use generateContent for Gemini models (e.g. gemini-2.5-flash-image)
                 console.log(`[ImageGen] Using Gemini model: ${modelName}`);
                 const response = await ai.models.generateContent({
                    model: modelName,
                    contents: { parts: [{ text: promptText }] }, // Use structured contents
                    config: {
                        safetySettings: SAFETY_SETTINGS // Use permissive safety settings
                    }
                 });

                 const parts = response.candidates?.[0]?.content?.parts;
                 if (parts) {
                    for (const part of parts) {
                      if (part.inlineData && part.inlineData.data) {
                        console.log("[ImageGen] Google Success");
                        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                      }
                    }
                    
                    // Check if there is text refusal
                    const textParts = parts.filter(p => p.text).map(p => p.text).join(' ');
                    if (textParts) {
                        console.warn("[ImageGen] Model returned text refusal:", textParts);
                        throw new Error(`Model refused to generate image: ${textParts.substring(0, 100)}...`);
                    }
                 }
                 throw new Error("No image generated by Gemini (Response empty)");
              }
          } catch (e: any) {
              if (!isRetry && isAuthError(e) && window.aistudio) {
                  console.log("API Key entity not found during image gen. Prompting user...");
                  await window.aistudio.openSelectKey();
                  return attempt(true);
              }
              console.error("[ImageGen] Google Error:", e);
              throw new Error(`Image Generation Failed: ${e.message}`);
          }
      };
      return attempt(false);
  } 
  
  // OpenAI Image Gen (DALL-E)
  if (config.provider === 'openai' || ((config.provider === 'custom' || config.provider === 'qwen' || config.provider === 'volcengine') && config.imageModel?.includes('dall-e'))) {
      const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/images/generations`;
      const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
      };
      
      const body = {
          model: config.imageModel || "dall-e-3",
          prompt: promptText,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
      };

      const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body)
      });

      if (!res.ok) {
          throw new Error(`OpenAI Image Gen failed: ${await res.text()}`);
      }

      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      throw new Error("No image returned from OpenAI");
  }

  // Fallback
  if (process.env.API_KEY) {
      const attemptFallback = async (isRetry: boolean): Promise<string> => {
          console.warn("Falling back to Google for image generation.");
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: { parts: [{ text: promptText }] },
                config: {
                    safetySettings: SAFETY_SETTINGS
                }
            });
            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                }
                }
            }
             throw new Error("Fallback produced no image");
          } catch (e: any) {
              if (!isRetry && isAuthError(e) && window.aistudio) {
                  await window.aistudio.openSelectKey();
                  return attemptFallback(true);
              }
              console.error("Fallback generation failed:", e);
              throw e;
          }
      };
      return attemptFallback(false);
  }

  throw new Error("Selected provider does not support image generation and no fallback Google key available.");
};


// --- Video Generation Logic (Google Veo Only) ---

export const generateVeoVideo = async (
  prompt: string, 
  referenceImageBase64?: string, 
  aspectRatio: '16:9' | '9:16' = '16:9',
  config?: ModelConfig
): Promise<string> => {
  
  console.log(`[Veo] Generating video for prompt: ${prompt.slice(0, 50)}...`);

  const attempt = async (isRetry: boolean): Promise<string> => {
      let apiKey = process.env.API_KEY;
      if (config && config.provider === 'google' && config.apiKey) {
          apiKey = config.apiKey;
      }

      if (!apiKey && window.aistudio && window.aistudio.hasSelectedApiKey) {
         await window.aistudio.openSelectKey();
         apiKey = process.env.API_KEY; 
      }

      if (!apiKey) {
          throw new Error("Google API Key required for Veo video generation.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = config?.videoModel || 'veo-3.1-fast-generate-preview';

      try {
          let operation;
          
          const videoConfig = {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio,
          };

          if (referenceImageBase64) {
            const base64Data = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
            
            operation = await ai.models.generateVideos({
              model: modelName,
              prompt: prompt,
              image: {
                imageBytes: base64Data,
                mimeType: 'image/png', 
              },
              config: videoConfig
            });
          } else {
            operation = await ai.models.generateVideos({
              model: modelName,
              prompt: prompt,
              config: videoConfig
            });
          }

          while (!operation.done) {
            console.log("[Veo] Waiting for operation...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
          }

          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!videoUri) {
            throw new Error("Video generation failed or no URI returned.");
          }

          const downloadUrl = `${videoUri}&key=${apiKey}`;
          const res = await fetch(downloadUrl);
          const blob = await res.blob();
          return URL.createObjectURL(blob);

      } catch (e: any) {
          if (!isRetry && isAuthError(e) && window.aistudio) {
              console.log("Veo generation auth error, requesting key...");
              await window.aistudio.openSelectKey();
              return attempt(true);
          }
          throw e;
      }
  };
  return attempt(false);
};

// --- Story Polish Logic ---

const POLISH_JSON_SCHEMA_OBJECT = {
  type: "object",
  properties: {
    critique: { type: "string", description: "Critique of the original story pointing out conflicts, plot holes, or areas for improvement." },
    rewritten_story: { type: "string", description: "The rewritten version of the story." },
    changes_made: { 
        type: "array", 
        items: { type: "string" }, 
        description: "List of key changes made to fix the issues." 
    }
  },
  required: ["critique", "rewritten_story", "changes_made"],
};

export const polishStory = async (storyText: string, config: ModelConfig, lang: Language = 'en'): Promise<StoryPolishResponse> => {
    console.log(`[Polish] Starting story polish with provider ${config.provider} in ${lang}...`);
    
    const langInstruction = lang === 'zh' 
        ? "OUTPUT INSTRUCTION: Return the 'critique', 'rewritten_story', and 'changes_made' in Chinese (Simplified)." 
        : "Respond in English.";

    const prompt = `
    Act as a professional story editor and script doctor.
    Analyze the following story draft. Identify:
    1. Logical inconsistencies or plot holes.
    2. Narrative flow issues.
    3. Character motivation conflicts.
    
    Then, rewrite the story to fix these issues while maintaining the original tone. 
    Make it more engaging and suitable for visual storytelling.

    ${langInstruction}

    Original Story:
    ${storyText}
    `;

    if (config.provider === 'google') {
        const attempt = async (isRetry: boolean): Promise<StoryPolishResponse> => {
            const ai = getGoogleClient(config.apiKey);
            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    critique: { type: Type.STRING },
                    rewritten_story: { type: Type.STRING },
                    changes_made: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["critique", "rewritten_story", "changes_made"]
            };

            try {
                // Attempt 1: Strict
                try {
                    const response = await ai.models.generateContent({
                        model: config.textModel || "gemini-2.5-flash",
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: schema,
                            temperature: config.inferenceConfig?.temperature,
                            topP: config.inferenceConfig?.topP,
                            maxOutputTokens: config.inferenceConfig?.maxTokens,
                            safetySettings: SAFETY_SETTINGS
                        }
                    });
            
                    const text = response.text;
                    console.log("[Polish] Google Response:", text?.substring(0, 100) + "...");

                    if (!text) throw new Error("No polish generated from Google.");
                    
                    return safeJSONParse<StoryPolishResponse>(text);

                } catch (e: any) {
                    if (isAuthError(e)) throw e; // Bubble up auth errors

                    console.warn("[Polish] Strict schema failed, trying fallback...", e);
                    // Attempt 2: Fallback
                    const response = await ai.models.generateContent({
                        model: config.textModel || "gemini-2.5-flash",
                        contents: `${prompt}\n\nIMPORTANT: Return valid JSON matching this structure:\n${JSON.stringify(POLISH_JSON_SCHEMA_OBJECT)}`,
                        config: {
                            responseMimeType: "application/json",
                            temperature: config.inferenceConfig?.temperature,
                            topP: config.inferenceConfig?.topP,
                            maxOutputTokens: config.inferenceConfig?.maxTokens,
                            safetySettings: SAFETY_SETTINGS
                        }
                    });

                    const text = response.text;
                    if (!text) throw new Error("No polish generated from Google (Fallback).");
                    return safeJSONParse<StoryPolishResponse>(text);
                }
            } catch (e: any) {
                if (!isRetry && isAuthError(e) && window.aistudio) {
                    console.log("Polish auth error, requesting key...");
                    await window.aistudio.openSelectKey();
                    return attempt(true);
                }
                throw e;
            }
        };
        return attempt(false);

    } else {
        // Compatible providers
        const messages = [
            {
                role: "system",
                content: `You are a professional story editor. 
                Analyze the user's story for conflicts and logical errors. Rewrite it to be better.
                ${langInstruction}
                Return strictly valid JSON matching this schema:
                ${JSON.stringify(POLISH_JSON_SCHEMA_OBJECT)}`
            },
            {
                role: "user",
                content: storyText
            }
        ];

        const body: any = {
            model: config.textModel,
            messages: messages,
            temperature: config.inferenceConfig?.temperature,
            top_p: config.inferenceConfig?.topP,
            max_tokens: config.inferenceConfig?.maxTokens,
        };

        if (config.provider === 'openai' || config.provider === 'custom' || config.provider === 'volcengine' || config.provider === 'qwen') {
             if (config.provider === 'openai') {
                body.response_format = { type: "json_object" };
             }
        }
        if (config.provider === 'ollama') {
            body.format = "json";
            body.stream = false;
        }

        const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };
        if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`Polish request failed: ${response.status}`);
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        console.log("[Polish] OpenAI Compatible Response:", content?.substring(0, 100) + "...");

        if (!content) throw new Error("Empty response");
        
        return safeJSONParse<StoryPolishResponse>(content);
    }
};