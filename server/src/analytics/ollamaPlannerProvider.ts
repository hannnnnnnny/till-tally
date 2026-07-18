import { type AnalyticsPlannerProvider } from './analyticsPlanner';

const MAX_PROVIDER_OUTPUT_LENGTH = 100_000;

type OllamaPlannerProviderOptions = {
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
};

type OllamaChatEnvelope = {
  message?: {
    content?: unknown;
  };
};

export class OllamaPlannerProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaPlannerProviderError';
  }
}

export function createOllamaPlannerProvider(
  options: OllamaPlannerProviderOptions,
): AnalyticsPlannerProvider {
  const chatUrl = createChatUrl(options.baseUrl);
  const model = options.model.trim();
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!model || model.length > 120) {
    throw new OllamaPlannerProviderError('OLLAMA_MODEL must contain a valid model name');
  }

  return {
    async generate(request) {
      const response = await fetchImpl(chatUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          stream: false,
          think: false,
          format: request.schema,
          options: { temperature: 0 },
        }),
      });

      if (!response.ok) {
        throw new OllamaPlannerProviderError(
          `Ollama request failed with status ${response.status}`,
        );
      }

      const envelope = await parseEnvelope(response);
      const content = envelope.message?.content;

      if (typeof content !== 'string' || !content.trim()) {
        throw new OllamaPlannerProviderError('Ollama returned an invalid response envelope');
      }

      if (content.length > MAX_PROVIDER_OUTPUT_LENGTH) {
        throw new OllamaPlannerProviderError('Ollama response exceeded the allowed size');
      }

      return content;
    },
  };
}

function createChatUrl(baseUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new OllamaPlannerProviderError('OLLAMA_BASE_URL must be a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OllamaPlannerProviderError('OLLAMA_BASE_URL must use http or https');
  }

  return new URL('/api/chat', parsed).toString();
}

async function parseEnvelope(response: Response): Promise<OllamaChatEnvelope> {
  try {
    return (await response.json()) as OllamaChatEnvelope;
  } catch {
    throw new OllamaPlannerProviderError('Ollama returned invalid JSON');
  }
}
