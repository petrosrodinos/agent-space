import { Injectable, Logger } from '@nestjs/common';
import { embed, embedMany, generateObject, generateText, streamText } from 'ai';
import {
    AIGenerateObjectResponse,
    AIGenerateOptions,
    AIGenerateTextResponse,
    AIStreamTextOptions,
    EMBEDDING_MODEL,
    TranscribeInput,
    TranscribeResult,
    VISION_MODEL,
} from '../interfaces/ai.interface';
import { AiConfig } from '../utils/ai.config';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { calculateAiCost } from '../utils/ai-cost';

@Injectable()
export class AiService {

    constructor(private readonly aiConfig: AiConfig) { }

    private readonly logger = new Logger(AiService.name);

    async generateText(options: AIGenerateOptions): Promise<AIGenerateTextResponse> {
        try {

            // this.aiConfig.validateProviderAndModel(options.provider, options.model);

            const modelAdapter = this.aiConfig.getModelAdapter(options.provider, options.model);

            const { text, usage } = await generateText({
                prompt: options.prompt,
                model: modelAdapter,
                system: options?.system || 'You are a helpful assistant.',
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens,
                topP: options.topP,
                frequencyPenalty: options.frequencyPenalty,
                presencePenalty: options.presencePenalty,
            });

            const cost = calculateAiCost({
                provider: options.provider,
                model: options.model,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
            });

            return {
                response: text,
                usage: cost,
            };
        } catch (error) {
            this.logger.error(`Error generating text: ${error.message}`);
            throw new Error(`Failed to generate text: ${error.message}`);
        }
    }


    async generateTextWithSchema(options: AIGenerateOptions): Promise<AIGenerateObjectResponse> {
        const maxRetries = 3;
        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const modelAdapter = this.aiConfig.getModelAdapter(options.provider, options.model);

                const { object, usage } = await generateObject({
                    model: modelAdapter,
                    output: 'array',
                    schema: options?.schema || z.any(),
                    prompt: options.prompt,
                    system: options?.system || 'You are a helpful assistant.',
                });

                const cost = calculateAiCost({
                    provider: options.provider,
                    model: options.model,
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                });

                return {
                    response: object,
                    usage: cost,
                };

            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    this.logger.warn(`Schema validation error on attempt ${attempt}, retrying... Error: ${error.message}`);
                    continue;
                }

                this.logger.error(`Error generating text on attempt ${attempt}: ${error.message}`);
                throw new Error(`Failed to generate text: ${error.message}`);
            }
        }

        throw lastError || new Error('Failed to generate text after all retry attempts');
    }

    async streamText(options: AIStreamTextOptions): Promise<void> {
        try {

            this.aiConfig.validateProviderAndModel(options.provider, options.model);

            const modelAdapter = this.aiConfig.getModelAdapter(options.provider, options.model);

            const stream = await streamText({
                model: modelAdapter,
                system: options.system,
                prompt: options.prompt,
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens,
                topP: options.topP,
                frequencyPenalty: options.frequencyPenalty,
                presencePenalty: options.presencePenalty,
            });

            let fullText = '';

            for await (const chunk of stream.textStream) {
                if (options.onToken) {
                    options.onToken(chunk);
                }
                fullText += chunk;
            }

            if (options.onComplete) {
                options.onComplete(fullText);
            }

        } catch (error) {
            this.logger.error(`Error streaming text: ${error.message}`, error.stack);
            throw new Error(`Failed to stream text: ${error.message}`);
        }
    }

    async embedText(text: string): Promise<number[]> {
        const { embedding } = await embed({ model: openai.embedding(EMBEDDING_MODEL), value: text });
        return embedding;
    }

    /** Embeds many texts in batches (order preserved). */
    async embedMany(values: string[]): Promise<number[][]> {
        this.requireOpenAiKey();
        if (!values.length) return [];
        const { embeddings } = await embedMany({ model: openai.embedding(EMBEDDING_MODEL), values, maxParallelCalls: 4, maxRetries: 3 });
        return embeddings;
    }

    /**
     * Reads an image or PDF with a vision model: transcribes all visible text (OCR) as Markdown and briefly describes
     * charts, diagrams and photos, so the result can be searched like any other document.
     */
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
        this.requireOpenAiKey();
        const isImage = input.mediaType.startsWith('image/');
        const { text, finishReason } = await generateText({
            model: openai(VISION_MODEL),
            system:
                'You convert documents into searchable text. Transcribe ALL visible text exactly, in its original language and reading order, as Markdown ' +
                '(headings, lists, and Markdown tables for tables). For charts, diagrams, photos and other visuals, add a short factual description in ' +
                'square brackets, including any numbers they show. Do not summarise, translate, comment or add anything else. If there is nothing to read ' +
                'or describe, reply with an empty message.',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: isImage ? 'Transcribe this image.' : 'Transcribe every page of this document, separating pages with a blank line.' },
                        { type: 'file', data: input.data, mediaType: input.mediaType, filename: input.filename },
                    ],
                },
            ],
            temperature: 0,
            maxOutputTokens: 32_000,
            maxRetries: 3,
        });
        return { text: text.trim(), truncated: finishReason === 'length' };
    }

    private requireOpenAiKey() {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    }

}
