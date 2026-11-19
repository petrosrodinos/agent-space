/** USD per 1M tokens. */
export interface VoiceModelPrice {
    audio_in: number;
    audio_out: number;
    text_in: number;
    text_out: number;
    cached: number;
}

export interface VoiceModel {
    id: string;
    label: string;
    description: string;
    price: VoiceModelPrice;
}

/**
 * OpenAI Realtime models an organisation can choose for voice mode (§7.6, §13.4). Prices are OpenAI list prices and
 * feed the usage counters, so a model is only offered once its prices are known here.
 */
export const VOICE_MODELS: readonly VoiceModel[] = [
    {
        id: 'gpt-realtime-2.1',
        label: 'GPT Realtime 2.1',
        description: 'Most reliable with tools and approvals',
        price: { audio_in: 32, audio_out: 64, text_in: 4, text_out: 24, cached: 0.4 },
    },
    {
        id: 'gpt-realtime-2.1-mini',
        label: 'GPT Realtime 2.1 mini',
        description: 'About a third of the cost, less reliable with tools',
        price: { audio_in: 10, audio_out: 20, text_in: 0.6, text_out: 2.4, cached: 0.06 },
    },
    {
        id: 'gpt-realtime',
        label: 'GPT Realtime (2025)',
        description: 'Original model; may claim actions without doing them',
        price: { audio_in: 32, audio_out: 64, text_in: 4, text_out: 16, cached: 0.4 },
    },
] as const;

export const DEFAULT_VOICE_MODEL = 'gpt-realtime-2.1';
export const VOICE_MODEL_IDS = VOICE_MODELS.map((m) => m.id);
