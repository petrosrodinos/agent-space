import { z } from 'zod';

export interface AIGenerateOptions {
    provider?: AiProvider;
    model?: AiModel;
    system?: string;
    prompt: string;
    schema?: z.ZodSchema;
    output?: 'json' | 'no-schema';
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export interface AIGenerateTextResponse {
    response: string;
    usage?: AICostResponse
}

export interface AIGenerateObjectResponse {
    response: z.ZodSchema[] | null;
    usage?: AICostResponse
}



export interface AIStreamTextOptions extends AIGenerateOptions {
    onToken?: (token: string) => void;
    onComplete?: (fullText: string) => void;
}

export interface AIModelInfo {
    provider: AiProvider;
    model: AiModel;
}

export interface AICost {
    provider?: AiProvider,
    model?: AiModel,
    inputTokens: number,
    outputTokens: number,
}

export interface AICostResponse {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputRate: number;
    outputRate: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
}

export const AiProviders = {
    openai: 'openai',
    grok: 'grok',
    gemini: 'gemini',
} as const;

export const AiModels = {
    openai: {
        gpt4o: 'gpt-4o',
        gpt4oMini: 'gpt-4o-mini',
        gpt4Turbo: 'gpt-4-turbo',
        gpt4: 'gpt-4',
        gpt35Turbo: 'gpt-3.5-turbo',
        gpt41Mini: 'gpt-4.1-mini',
        textEmbedding3Small: 'text-embedding-3-small',
    },
    grok: {
        grokBeta: 'grok-beta',
        grokPro: 'grok-pro',
    },
    gemini: {
        geminiPro: 'gemini-pro',
        geminiProVision: 'gemini-pro-vision',
        gemini15Pro: 'gemini-1.5-pro',
        gemini15Flash: 'gemini-1.5-flash',
    }
}

export type AiProvider = typeof AiProviders[keyof typeof AiProviders];
export type AiModel = string;



/** Embeddings for knowledge search: OpenAI text-embedding-3-small, 1536 dimensions. */
export const EMBEDDING_MODEL = AiModels.openai.textEmbedding3Small;
export const EMBEDDING_DIMS = 1536;

/** Reads images and scanned PDF pages (OCR + descriptions of visuals). */
export const VISION_MODEL = AiModels.openai.gpt41Mini;

export interface TranscribeInput {
    data: Buffer;
    /** image/png, image/jpeg, image/webp, image/gif or application/pdf. */
    mediaType: string;
    filename?: string;
}

export interface TranscribeResult {
    text: string;
    /** The model hit its output limit, so the end of the document may be missing. */
    truncated: boolean;
}
