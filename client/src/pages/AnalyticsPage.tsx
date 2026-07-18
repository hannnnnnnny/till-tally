import { RotateCcw, Send, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  executeAnalyticsPlan,
  planAnalyticsQuestion,
  previewAnalyticsPlan,
} from '../analytics/api';
import { PlanReviewPanel } from '../analytics/PlanReviewPanel';
import { validateAnalyticsPlan } from '../analytics/plan';
import {
  type AnalyticsExecutionResult,
  type AnalyticsPlan,
  type AnalyticsPlanningResult,
} from '../analytics/types';
import { useBusinesses } from '../businesses/BusinessContext';
import { PageHeader } from '../ui/PageLayout';
import { InlineNotice, StatePanel } from '../ui/StatePanel';
import { getActionClassName } from '../ui/layout';

type WorkspaceStatus =
  | 'idle'
  | 'planning'
  | 'ready'
  | 'clarification'
  | 'unsupported'
  | 'executing'
  | 'complete'
  | 'error';

type RetryAction = 'plan' | 'execute';

const EXAMPLE_PROMPTS = [
  'Show daily revenue this month',
  'Top 10 products by revenue',
  'Compare gross margin by category',
  'Show low-stock products by status',
];

export function AnalyticsPage() {
  const {
    activeBusiness,
    activeBusinessHeaders,
    activeBusinessId,
    status: businessStatus,
  } = useBusinesses();
  const [prompt, setPrompt] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('idle');
  const [plan, setPlan] = useState<AnalyticsPlan | null>(null);
  const [planSource, setPlanSource] = useState<'local' | 'provider'>('local');
  const [planMessage, setPlanMessage] = useState('');
  const [guidance, setGuidance] = useState<string | null>(null);
  const [guidanceExamples, setGuidanceExamples] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyticsExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>('plan');
  const requestControllerRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const activeBusinessIdRef = useRef(activeBusinessId);
  activeBusinessIdRef.current = activeBusinessId;

  const planErrors = useMemo(() => (plan ? validateAnalyticsPlan(plan) : []), [plan]);
  const isBusy = status === 'planning' || status === 'executing';

  useEffect(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setPrompt('');
    setPromptError(null);
    setStatus('idle');
    setPlan(null);
    setPlanMessage('');
    setGuidance(null);
    setGuidanceExamples([]);
    setResult(null);
    setError(null);
  }, [activeBusinessId]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  async function submitQuestion(question = prompt): Promise<void> {
    const cleanQuestion = question.trim();
    const validationMessage = validatePrompt(cleanQuestion);

    if (validationMessage) {
      setPromptError(validationMessage);
      promptRef.current?.focus();
      return;
    }

    if (!activeBusinessHeaders) {
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const requestBusinessId = activeBusinessId;
    requestControllerRef.current = controller;
    setPrompt(cleanQuestion);
    setPromptError(null);
    setStatus('planning');
    setPlan(null);
    setGuidance(null);
    setGuidanceExamples([]);
    setResult(null);
    setError(null);
    setRetryAction('plan');

    try {
      const planningResult = await planAnalyticsQuestion(
        activeBusinessHeaders,
        { question: cleanQuestion, timezone: 'Pacific/Auckland' },
        { signal: controller.signal },
      );

      if (activeBusinessIdRef.current !== requestBusinessId) {
        return;
      }

      applyPlanningResult(planningResult);
    } catch (planningError) {
      if (isAbortError(planningError)) {
        return;
      }

      setError(getRequestError(planningError, 'Unable to interpret that question right now.'));
      setStatus('error');
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  function applyPlanningResult(planningResult: AnalyticsPlanningResult): void {
    setPlanSource(planningResult.source);

    if (planningResult.status === 'ready') {
      setPlan(planningResult.plan);
      setPlanMessage(planningResult.message);
      setStatus('ready');
      return;
    }

    setGuidance(planningResult.message);
    setGuidanceExamples(planningResult.examples);
    setStatus(planningResult.status);
  }

  async function runAnalysis(): Promise<void> {
    if (!activeBusinessHeaders || !plan || planErrors.length > 0) {
      return;
    }

    requestControllerRef.current?.abort();
    const controller = new AbortController();
    const requestBusinessId = activeBusinessId;
    requestControllerRef.current = controller;
    setStatus('executing');
    setResult(null);
    setError(null);
    setRetryAction('execute');

    try {
      await previewAnalyticsPlan(activeBusinessHeaders, plan, { signal: controller.signal });

      if (activeBusinessIdRef.current !== requestBusinessId) {
        return;
      }

      const executionResult = await executeAnalyticsPlan(activeBusinessHeaders, plan, {
        signal: controller.signal,
      });

      if (activeBusinessIdRef.current !== requestBusinessId) {
        return;
      }

      setResult(executionResult);
      setStatus('complete');
    } catch (executionError) {
      if (isAbortError(executionError)) {
        return;
      }

      setError(getRequestError(executionError, 'Unable to run this analysis right now.'));
      setStatus('error');
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }

  function cancelRequest(): void {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setStatus(status === 'executing' && plan ? 'ready' : 'idle');
  }

  function resetWorkspace(): void {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setPrompt('');
    setPromptError(null);
    setStatus('idle');
    setPlan(null);
    setPlanMessage('');
    setGuidance(null);
    setGuidanceExamples([]);
    setResult(null);
    setError(null);
    promptRef.current?.focus();
  }

  function retry(): void {
    if (retryAction === 'execute' && plan) {
      void runAnalysis();
      return;
    }

    void submitQuestion();
  }

  function chooseExample(example: string): void {
    setPrompt(example);
    setPromptError(null);
    promptRef.current?.focus();
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submitQuestion();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitQuestion();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guided analytics"
        title="Ask TillTally"
        description={
          activeBusiness
            ? `Turn a question about ${activeBusiness.name} into a reviewable, read-only analysis.`
            : 'Select a business before asking a question.'
        }
        actions={
          status !== 'idle' && (
            <button
              type="button"
              onClick={resetWorkspace}
              disabled={isBusy}
              className={getActionClassName('secondary')}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              New question
            </button>
          )
        }
      />

      {businessStatus !== 'loading' && !activeBusinessHeaders && (
        <StatePanel
          minHeight="lg"
          title="Select a business first"
          message="Ask TillTally keeps every question and result inside the active business."
        />
      )}

      {activeBusinessHeaders && (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          <section className="self-start overflow-hidden rounded-lg bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] xl:sticky xl:top-20">
            <div className="border-b border-white/10 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase text-blue-300">Question</p>
              <h3 className="mt-1 text-lg font-bold">What do you want to understand?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Ask about revenue, margin, orders, products, channels, or inventory risk.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-4 py-5 sm:px-5">
              <label htmlFor="analytics-question" className="sr-only">
                Business analytics question
              </label>
              <textarea
                ref={promptRef}
                id="analytics-question"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setPromptError(null);
                }}
                onKeyDown={handlePromptKeyDown}
                disabled={isBusy}
                minLength={3}
                maxLength={500}
                rows={5}
                placeholder="For example: Compare revenue by channel this month"
                aria-describedby="analytics-question-help analytics-question-count"
                aria-invalid={promptError !== null}
                className="min-h-32 w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-base leading-6 text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              />
              <div className="mt-2 flex items-start justify-between gap-3 text-xs text-slate-400">
                <span id="analytics-question-help">Ctrl or Command + Enter to submit</span>
                <span id="analytics-question-count" className="shrink-0 tabular-nums">
                  {prompt.length}/500
                </span>
              </div>

              {promptError && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-300">
                  {promptError}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={isBusy || prompt.trim().length === 0}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {status === 'planning' ? 'Interpreting...' : 'Review question'}
                </button>
                {isBusy && (
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-200 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <Square aria-hidden="true" className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="border-t border-white/10 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase text-slate-400">Try an example</p>
              <div className="mt-2 grid gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => chooseExample(example)}
                    disabled={isBusy}
                    className="min-h-11 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm font-medium leading-5 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section aria-label="Analysis review" className="min-w-0">
            {status === 'idle' && (
              <StatePanel
                minHeight="lg"
                title="Your plan will appear here"
                message="TillTally interprets the question into bounded metrics, groupings, dates, filters, and a chart choice for you to review."
              />
            )}

            {status === 'planning' && <PlanningState />}

            {(status === 'clarification' || status === 'unsupported') && (
              <GuidanceState
                status={status}
                message={guidance ?? 'Try rephrasing the question.'}
                examples={guidanceExamples}
                onChoose={chooseExample}
              />
            )}

            {status === 'error' && (
              <InlineNotice tone="error" action={{ label: 'Retry', onClick: retry }}>
                <p className="font-semibold">Ask TillTally could not complete the request</p>
                <p className="mt-1">{error ?? 'Please try again.'}</p>
              </InlineNotice>
            )}

            {plan && (
              <div className={status === 'error' ? 'mt-4' : ''}>
                <PlanReviewPanel
                  plan={plan}
                  source={planSource}
                  message={planMessage}
                  errors={planErrors}
                  disabled={status === 'executing'}
                  onChange={(nextPlan) => {
                    setPlan(nextPlan);
                    setResult(null);
                    if (status === 'complete' || status === 'error') {
                      setStatus('ready');
                      setError(null);
                    }
                  }}
                  onRun={() => void runAnalysis()}
                />
              </div>
            )}

            {status === 'executing' && (
              <InlineNotice
                tone="loading"
                className="mt-4"
                action={{ label: 'Cancel', onClick: cancelRequest }}
              >
                Validating and running this read-only analysis...
              </InlineNotice>
            )}

            {status === 'complete' && result && <AnalysisResult result={result} />}
          </section>
        </div>
      )}
    </div>
  );
}

function PlanningState() {
  return (
    <div
      aria-label="Interpreting question"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <div className="h-3 w-28 animate-pulse rounded bg-blue-100" />
      <div className="mt-3 h-7 w-56 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-md bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function GuidanceState({
  status,
  message,
  examples,
  onChoose,
}: {
  status: 'clarification' | 'unsupported';
  message: string;
  examples: string[];
  onChoose: (example: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6">
      <p className="text-xs font-semibold uppercase text-amber-700">
        {status === 'clarification'
          ? 'A little more detail needed'
          : 'Question outside current scope'}
      </p>
      <h3 className="mt-1 text-xl font-bold text-slate-950">
        {status === 'clarification' ? 'Clarify the business question' : 'Try a supported analysis'}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{message}</p>
      {examples.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onChoose(example)}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisResult({ result }: { result: AnalyticsExecutionResult }) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700">Analysis complete</p>
          <h3 className="mt-1 text-lg font-bold text-slate-950">{result.title}</h3>
        </div>
        <p className="text-xs font-medium text-slate-500">
          {result.meta.rowCount} rows · {result.meta.durationMs} ms
        </p>
      </div>

      {result.table.rows.length === 0 ? (
        <StatePanel
          minHeight="sm"
          className="m-4 sm:m-5"
          title="No matching data"
          message="Try a wider date range or remove a filter from the reviewed plan."
        />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                {result.table.columns.map((column) => (
                  <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3 sm:px-5">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="text-slate-700">
                  {result.table.columns.map((column) => (
                    <td
                      key={column.key}
                      className="whitespace-nowrap px-4 py-3 tabular-nums sm:px-5"
                    >
                      {formatResultValue(row[column.key], column.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function validatePrompt(question: string): string | null {
  if (question.length < 3) {
    return 'Enter a question with at least 3 characters.';
  }

  if (question.length > 500) {
    return 'Keep the question to 500 characters or fewer.';
  }

  return null;
}

function getRequestError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function formatResultValue(value: string | number | null | undefined, unit: string | null): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value !== 'number') {
    return value;
  }

  if (unit === 'NZD') {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (unit === 'percent') {
    return `${value.toFixed(1)}%`;
  }

  return new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 2 }).format(value);
}
