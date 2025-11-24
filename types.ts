
export enum AssetType {
    CHARACTER = 'CHARACTER',
    SCENE = 'SCENE',
    PROP = 'PROP',
    ANIMAL_PLANT = 'ANIMAL_PLANT',
    OTHER = 'OTHER'
  }
  
  export interface StoryAsset {
    id: string;
    type: AssetType;
    name: string;
    description: string;
    imageUrl?: string; // Base64 or URL
    isGenerating: boolean;
    negativePrompt?: string;
  }
  
  export interface PlotPoint {
    id: string;
    description: string;
    referenceAssetId?: string; // The ID of the image used as a start frame
    customImage?: string; // Base64 of uploaded image
    aspectRatio?: '16:9' | '9:16';
    videoUrl?: string;
    status: 'idle' | 'generating' | 'completed' | 'failed';
    prompt: string;
    generatedAt?: number;
  }
  
  export interface StoryAnalysis {
    title: string;
    characters: { name: string; description: string }[];
    scenes: { description: string }[];
    props: { name: string; description: string }[];
    animals_plants: { name: string; description: string }[];
    others: { name: string; description: string }[];
    plot_points: { description: string; suggested_visual: string }[];
  }

  export interface StoryPolishResponse {
    critique: string;
    rewritten_story: string;
    changes_made: string[];
  }
  
  export interface GenerationState {
    step: 'input' | 'analysis' | 'assets' | 'storyboard' | 'preview';
    isAnalyzing: boolean;
  }

  export interface StoryProject {
    id: string;
    title: string;
    hasCustomTitle?: boolean;
    lastModified: number;
    content: string;
    assets: StoryAsset[];
    plotPoints: PlotPoint[];
    state: GenerationState;
  }

  export type Language = 'en' | 'zh';

  export type ProviderType = 'google' | 'openai' | 'ollama' | 'volcengine' | 'qwen' | 'custom';

  export interface InferenceConfig {
    temperature: number;
    topP: number;
    maxTokens: number;
  }

  export interface ModelConfig {
    provider: ProviderType;
    apiKey: string;
    baseUrl: string; // e.g., https://api.openai.com/v1
    textModel: string; // e.g., gpt-4o, qwen-max, gemini-2.5-flash
    imageModel?: string; // e.g., dall-e-3, gemini-2.5-flash-image
    videoModel?: string; // e.g., veo-3.1-fast-generate-preview
    inferenceConfig?: InferenceConfig;
  }

  export interface SavedModel extends ModelConfig {
    id: string;
    name: string;
  }
  
  // Augment window for the specific AI Studio Key Selection API
  declare global {
    // Define the interface that matches the expected type for window.aistudio.
    interface AIStudio {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    }
  }