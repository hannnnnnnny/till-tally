import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA } from '@till-tally/analytics-contracts';
import { createOllamaPlannerProvider, OllamaPlannerProviderError } from './ollamaPlannerProvider';

const providerRequest = {
  systemPrompt: 'System catalog',
  userPrompt: '{"question":"Revenue by channel"}',
  schema: ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA,
  signal: new AbortController().signal,
};

describe('Ollama analytics planner provider', () => {
  it('requests deterministic non-streaming structured output', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const provider = createOllamaPlannerProvider({
      baseUrl: 'http://127.0.0.1:11434/',
      model: 'local-test-model',
      fetchImpl: async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return jsonResponse({
          message: { role: 'assistant', content: '{"status":"unsupported"}' },
          done: true,
        });
      },
    });

    const output = await provider.generate(providerRequest);
    const body = JSON.parse(String(capturedInit?.body));

    assert.equal(capturedUrl, 'http://127.0.0.1:11434/api/chat');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(capturedInit?.signal, providerRequest.signal);
    assert.equal(body.model, 'local-test-model');
    assert.equal(body.stream, false);
    assert.equal(body.think, false);
    assert.equal(body.options.temperature, 0);
    assert.deepEqual(body.format, ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA);
    assert.deepEqual(body.messages, [
      { role: 'system', content: providerRequest.systemPrompt },
      { role: 'user', content: providerRequest.userPrompt },
    ]);
    assert.equal(output, '{"status":"unsupported"}');
  });

  it('rejects non-http provider URLs', () => {
    assert.throws(
      () => createOllamaPlannerProvider({ baseUrl: 'file:///etc/passwd', model: 'model' }),
      OllamaPlannerProviderError,
    );
  });

  it('throws a typed error for HTTP failures and malformed envelopes', async () => {
    const failingProvider = createOllamaPlannerProvider({
      baseUrl: 'http://localhost:11434',
      model: 'model',
      fetchImpl: async () => jsonResponse({ error: 'model missing' }, 404),
    });
    await assert.rejects(
      () => failingProvider.generate(providerRequest),
      OllamaPlannerProviderError,
    );

    const malformedProvider = createOllamaPlannerProvider({
      baseUrl: 'http://localhost:11434',
      model: 'model',
      fetchImpl: async () => jsonResponse({ done: true }),
    });
    await assert.rejects(
      () => malformedProvider.generate(providerRequest),
      OllamaPlannerProviderError,
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
