import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatToolCall {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
}

export type ChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
    role: ChatRole;
    content: string | ChatContentPart[] | null;
    name?: string;
    tool_calls?: ChatToolCall[];
    tool_call_id?: string;
}

export interface ChatToolDef {
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatUsage {
    prompt_tokens: number;
    completion_tokens: number;
    cost: number;
}

export interface ChatResult {
    content: string;
    tool_calls: ChatToolCall[];
    finish_reason: string | null;
    model: string;
    usage: ChatUsage;
    citations?: { url: string; title: string | null }[];
}

export interface ChatStreamOptions {
    model: string;
    fallbackModels?: string[];
    messages: ChatMessage[];
    tools?: ChatToolDef[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    onTextDelta?: (delta: string) => void;
    onToolCallStart?: (name: string, index: number) => void;
}

export interface OpenRouterModel {
    id: string;
    name: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
    architecture?: { input_modalities?: string[] };
    supported_parameters?: string[];
}

const BASE_URL = 'https://openrouter.ai/api/v1';

/** AI partner (§6.4). All text models go through OpenRouter; the API key never leaves the server. */
@Injectable()
export class OpenRouterService {
    private readonly logger = new Logger(OpenRouterService.name);

    constructor(private readonly config: ConfigService) { }

    private headers() {
        const key = this.config.get<string>('OPEN_ROUTER_API_KEY');
        if (!key) throw new ServiceUnavailableException('AI provider is not configured');
        return {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.config.get('APP_URL') || 'https://agentspace.app',
            'X-Title': 'Agent Space',
        };
    }

    async listModels(): Promise<OpenRouterModel[]> {
        const res = await fetch(`${BASE_URL}/models`, { headers: this.headers() });
        if (!res.ok) throw new ServiceUnavailableException(`Model list unavailable (${res.status})`);
        const json = (await res.json()) as { data: OpenRouterModel[] };
        return json.data;
    }

    private body(opts: ChatStreamOptions, stream: boolean) {
        const fallbacks = (opts.fallbackModels ?? []).filter((m) => m && m !== opts.model);
        return JSON.stringify({
            model: opts.model,
            ...(fallbacks.length ? { models: [opts.model, ...fallbacks].slice(0, 3) } : {}),
            messages: opts.messages,
            ...(opts.tools?.length ? { tools: opts.tools, tool_choice: 'auto' } : {}),
            temperature: opts.temperature,
            max_tokens: opts.maxTokens,
            stream,
            usage: { include: true },
        });
    }

    /** One image from a text prompt, as a `data:` URL. Uses an image-capable model through the same OpenRouter key. */
    async generateImage(prompt: string, model = this.config.get<string>('AVATAR_IMAGE_MODEL') || 'google/gemini-2.5-flash-image'): Promise<string> {
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'], stream: false }),
            signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok) throw new ServiceUnavailableException(`Image generation failed (${res.status})`);
        const json: any = await res.json();
        const url: unknown = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (typeof url !== 'string' || !url.startsWith('data:image/')) throw new ServiceUnavailableException('The model did not return an image. Try a different description.');
        return url;
    }

    /** Non-streaming completion for small internal tasks (drafting a bot, titles, summaries). */
    async complete(opts: Omit<ChatStreamOptions, 'onTextDelta' | 'onToolCallStart'> & { json?: boolean }): Promise<ChatResult> {
        const body = JSON.parse(this.body(opts, false));
        if (opts.json) body.response_format = { type: 'json_object' };
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
            signal: opts.signal,
        });
        if (!res.ok) throw new ServiceUnavailableException(`AI request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
        const json: any = await res.json();
        const choice = json.choices?.[0];
        const annotations = (choice?.message?.annotations ?? []).filter((a: any) => a.type === 'url_citation').map((a: any) => ({ url: a.url_citation?.url, title: a.url_citation?.title }));
        const citations = annotations.length ? annotations : (json.citations ?? []).map((url: string) => ({ url, title: null }));
        return {
            citations,
            content: choice?.message?.content ?? '',
            tool_calls: choice?.message?.tool_calls ?? [],
            finish_reason: choice?.finish_reason ?? null,
            model: json.model ?? opts.model,
            usage: {
                prompt_tokens: json.usage?.prompt_tokens ?? 0,
                completion_tokens: json.usage?.completion_tokens ?? 0,
                cost: Number(json.usage?.cost ?? 0),
            },
        };
    }

    /** Streams a chat completion (SSE), accumulating text and tool calls. */
    async stream(opts: ChatStreamOptions): Promise<ChatResult> {
        const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: this.headers(),
            body: this.body(opts, true),
            signal: opts.signal,
        });
        if (!res.ok || !res.body) {
            const text = await res.text().catch(() => '');
            throw new ServiceUnavailableException(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
        }

        const result: ChatResult = {
            content: '',
            tool_calls: [],
            finish_reason: null,
            model: opts.model,
            usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
        };
        const calls = new Map<number, ChatToolCall>();
        const decoder = new TextDecoder();
        let buffer = '';

        const reader = res.body.getReader();
        for (; ;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') continue;
                let chunk: any;
                try {
                    chunk = JSON.parse(data);
                } catch {
                    continue;
                }
                if (chunk.error) {
                    throw new ServiceUnavailableException(`AI provider error: ${chunk.error.message ?? 'unknown'}`);
                }
                if (chunk.model) result.model = chunk.model;
                if (chunk.usage) {
                    result.usage = {
                        prompt_tokens: chunk.usage.prompt_tokens ?? 0,
                        completion_tokens: chunk.usage.completion_tokens ?? 0,
                        cost: Number(chunk.usage.cost ?? 0),
                    };
                }
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                if (choice.finish_reason) result.finish_reason = choice.finish_reason;
                const delta = choice.delta ?? {};
                if (typeof delta.content === 'string' && delta.content) {
                    result.content += delta.content;
                    opts.onTextDelta?.(delta.content);
                }
                for (const tc of delta.tool_calls ?? []) {
                    const idx = tc.index ?? 0;
                    let call = calls.get(idx);
                    if (!call) {
                        call = { id: tc.id ?? `call_${idx}_${Date.now()}`, type: 'function', function: { name: '', arguments: '' } };
                        calls.set(idx, call);
                    }
                    if (tc.id) call.id = tc.id;
                    if (tc.function?.name) {
                        const first = !call.function.name;
                        call.function.name += tc.function.name;
                        if (first) opts.onToolCallStart?.(call.function.name, idx);
                    }
                    if (tc.function?.arguments) call.function.arguments += tc.function.arguments;
                }
            }
        }
        result.tool_calls = [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
        return result;
    }
}
