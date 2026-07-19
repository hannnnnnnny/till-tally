import { BookMarked, Download, RotateCcw, Save, Send, Sparkles, Square } from 'lucide-react';
import {
  lazy,
  Suspense,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addSavedAnalyticsReportVersion,
  createSavedAnalyticsReport,
  deleteSavedAnalyticsReport,
  duplicateSavedAnalyticsReport,
  executeAnalyticsPlan,
  listSavedAnalyticsReports,
  planAnalyticsQuestion,
  previewAnalyticsPlan,
  renameSavedAnalyticsReport,
} from '../analytics/api';
import { downloadAnalyticsCsv } from '../analytics/exportCsv';
import { PlanReviewPanel } from '../analytics/PlanReviewPanel';
import {
  SavedReportDeleteDialog,
  SavedReportNameDialog,
  SavedReportsPanel,
} from '../analytics/SavedReportsPanel';
import { validateAnalyticsPlan } from '../analytics/plan';
import {
  type AnalyticsExecutionResult,
  type AnalyticsPlan,
  type AnalyticsPlanningResult,
  type SavedAnalyticsReport,
} from '../analytics/types';
import { useBusinesses } from '../businesses/BusinessContext';
import { getDemoInfo } from '../config/demoInfo';
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
type SavedReportsStatus = 'idle' | 'loading' | 'ready' | 'error';
type NameDialogMode = 'create' | 'rename';

const EXAMPLE_PROMPTS = [
  'Show daily revenue this month',
  'Top 10 products by revenue',
  'Compare gross margin by category',
  'Show low-stock products by status',
];

const AnalyticsResultPanel = lazy(() =>
  import('../analytics/AnalyticsResultPanel').then(({ AnalyticsResultPanel: Panel }) => ({
    default: Panel,
  })),
);

export function AnalyticsPage() {
  const {
    activeBusiness,
    activeBusinessHeaders,
    activeBusinessId,
    status: businessStatus,
  } = useBusinesses();
  const [prompt, setPrompt] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  // In demo mode these questions have recorded results, so surfacing them
  // guides visitors to the paths that show real output.
  const demoPresetQuestions = getDemoInfo()?.presetQuestions ?? [];
  const [status, setStatus] = useState<WorkspaceStatus>('idle');
  const [plan, setPlan] = useState<AnalyticsPlan | null>(null);
  const [planSource, setPlanSource] = useState<'local' | 'provider'>('local');
  const [planMessage, setPlanMessage] = useState('');
  const [guidance, setGuidance] = useState<string | null>(null);
  const [guidanceExamples, setGuidanceExamples] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyticsExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>('plan');
  const [isRefining, setIsRefining] = useState(false);
  const [savedReportsOpen, setSavedReportsOpen] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedAnalyticsReport[]>([]);
  const [savedReportsStatus, setSavedReportsStatus] = useState<SavedReportsStatus>('idle');
  const [savedReportsError, setSavedReportsError] = useState<string | null>(null);
  const [activeSavedReportId, setActiveSavedReportId] = useState<string | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [nameDialogMode, setNameDialogMode] = useState<NameDialogMode | null>(null);
  const [nameDialogReport, setNameDialogReport] = useState<SavedAnalyticsReport | null>(null);
  const [reportName, setReportName] = useState('');
  const [nameDialogError, setNameDialogError] = useState<string | null>(null);
  const [deleteDialogReport, setDeleteDialogReport] = useState<SavedAnalyticsReport | null>(null);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const libraryOperationRef = useRef(0);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const activeBusinessIdRef = useRef(activeBusinessId);
  activeBusinessIdRef.current = activeBusinessId;

  const planErrors = useMemo(() => (plan ? validateAnalyticsPlan(plan) : []), [plan]);
  const isBusy = status === 'planning' || status === 'executing';

  useEffect(() => {
    libraryOperationRef.current += 1;
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
    setIsRefining(false);
    setSavedReports([]);
    setSavedReportsStatus(activeBusinessHeaders ? 'loading' : 'idle');
    setSavedReportsError(null);
    setActiveSavedReportId(null);
    setSavedReportsOpen(false);
    setNameDialogMode(null);
    setNameDialogReport(null);
    setNameDialogError(null);
    setDeleteDialogReport(null);
    setDeleteDialogError(null);
    setLibraryBusy(false);
    setWorkspaceNotice(null);
  }, [activeBusinessId]);

  useEffect(() => {
    if (!activeBusinessHeaders || !activeBusinessId) return;

    const controller = new AbortController();
    const requestBusinessId = activeBusinessId;
    setSavedReportsStatus('loading');
    void listSavedAnalyticsReports(activeBusinessHeaders, { signal: controller.signal })
      .then(({ reports }) => {
        if (activeBusinessIdRef.current !== requestBusinessId) return;
        setSavedReports(reports);
        setSavedReportsStatus('ready');
        setSavedReportsError(null);
      })
      .catch((loadError: unknown) => {
        if (isAbortError(loadError) || activeBusinessIdRef.current !== requestBusinessId) {
          return;
        }
        setSavedReportsStatus('error');
        setSavedReportsError(getRequestError(loadError, 'Unable to load saved reports.'));
      });

    return () => controller.abort();
  }, [activeBusinessHeaders, activeBusinessId]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  async function submitQuestion(question = prompt): Promise<void> {
    const cleanQuestion = question.trim();
    const validationMessage = validatePrompt(cleanQuestion);
    const refinementPlan = isRefining ? plan : null;

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
    if (!refinementPlan) {
      setPlan(null);
      setActiveSavedReportId(null);
    }
    setGuidance(null);
    setGuidanceExamples([]);
    setResult(null);
    setError(null);
    setWorkspaceNotice(null);
    setRetryAction('plan');

    try {
      const planningResult = await planAnalyticsQuestion(
        activeBusinessHeaders,
        {
          question: cleanQuestion,
          timezone: 'Pacific/Auckland',
          ...(refinementPlan ? { currentPlan: refinementPlan } : {}),
        },
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
      setIsRefining(false);
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
    setWorkspaceNotice(null);
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
    setIsRefining(false);
    setActiveSavedReportId(null);
    setWorkspaceNotice(null);
    promptRef.current?.focus();
  }

  async function reloadSavedReports(
    headers = activeBusinessHeaders,
    requestBusinessId = activeBusinessId,
  ): Promise<void> {
    if (!headers || !requestBusinessId) return;
    setSavedReportsStatus('loading');
    setSavedReportsError(null);
    try {
      const response = await listSavedAnalyticsReports(headers);
      if (activeBusinessIdRef.current !== requestBusinessId) return;
      setSavedReports(response.reports);
      setSavedReportsStatus('ready');
    } catch (loadError) {
      if (activeBusinessIdRef.current !== requestBusinessId) return;
      setSavedReportsStatus('error');
      setSavedReportsError(getRequestError(loadError, 'Unable to load saved reports.'));
    }
  }

  function startLibraryOperation(): { id: number; businessId: string } | null {
    if (!activeBusinessId) return null;
    const id = libraryOperationRef.current + 1;
    libraryOperationRef.current = id;
    setLibraryBusy(true);
    return { id, businessId: activeBusinessId };
  }

  function isCurrentLibraryOperation(operation: { id: number; businessId: string }): boolean {
    return (
      libraryOperationRef.current === operation.id &&
      activeBusinessIdRef.current === operation.businessId
    );
  }

  function openCreateReportDialog(): void {
    if (!plan) return;
    setNameDialogMode('create');
    setNameDialogReport(null);
    setReportName(result?.title ?? planMessage ?? 'Untitled report');
    setNameDialogError(null);
  }

  function openRenameReportDialog(report: SavedAnalyticsReport): void {
    setNameDialogMode('rename');
    setNameDialogReport(report);
    setReportName(report.name);
    setNameDialogError(null);
  }

  async function submitReportNameDialog(): Promise<void> {
    const headers = activeBusinessHeaders;
    const planToSave = plan;
    if (!headers || !nameDialogMode || !reportName.trim()) return;
    const createInput = planToSave ? { plan: planToSave, source: planSource } : null;
    if (nameDialogMode === 'create' && !createInput) return;
    const operation = startLibraryOperation();
    if (!operation) return;
    setNameDialogError(null);

    try {
      if (nameDialogMode === 'create') {
        if (!createInput) return;
        const created = await createSavedAnalyticsReport(headers, {
          name: reportName.trim(),
          ...createInput,
        });
        if (!isCurrentLibraryOperation(operation)) return;
        setActiveSavedReportId(created.id);
        setWorkspaceNotice(`Saved "${created.name}" as version 1.`);
      } else if (nameDialogReport) {
        const renamed = await renameSavedAnalyticsReport(
          headers,
          nameDialogReport.id,
          reportName.trim(),
        );
        if (!isCurrentLibraryOperation(operation)) return;
        setWorkspaceNotice(`Renamed the report to "${renamed.name}".`);
      }

      setNameDialogMode(null);
      setNameDialogReport(null);
      await reloadSavedReports(headers, operation.businessId);
    } catch (saveError) {
      if (!isCurrentLibraryOperation(operation)) return;
      setNameDialogError(getRequestError(saveError, 'Unable to save this report.'));
    } finally {
      if (libraryOperationRef.current === operation.id) setLibraryBusy(false);
    }
  }

  function loadSavedReport(report: SavedAnalyticsReport): void {
    const savedPlan = report.latestVersion?.plan;
    if (!savedPlan) return;
    setPlan(savedPlan);
    setPlanSource(report.latestVersion?.source ?? 'local');
    setPlanMessage(`Loaded ${report.name}, version ${report.currentVersion}.`);
    setStatus('ready');
    setPrompt('');
    setPromptError(null);
    setResult(null);
    setError(null);
    setIsRefining(false);
    setActiveSavedReportId(report.id);
    setSavedReportsOpen(false);
    setWorkspaceNotice(`Loaded "${report.name}". Review the plan before running it.`);
  }

  async function duplicateReport(report: SavedAnalyticsReport): Promise<void> {
    const headers = activeBusinessHeaders;
    if (!headers) return;
    const operation = startLibraryOperation();
    if (!operation) return;
    setSavedReportsError(null);
    try {
      const duplicate = await duplicateSavedAnalyticsReport(headers, report.id);
      if (!isCurrentLibraryOperation(operation)) return;
      setWorkspaceNotice(`Created "${duplicate.name}".`);
      await reloadSavedReports(headers, operation.businessId);
    } catch (duplicateError) {
      if (!isCurrentLibraryOperation(operation)) return;
      setSavedReportsError(getRequestError(duplicateError, 'Unable to duplicate this report.'));
      setSavedReportsStatus('error');
    } finally {
      if (libraryOperationRef.current === operation.id) setLibraryBusy(false);
    }
  }

  async function removeReport(): Promise<void> {
    const headers = activeBusinessHeaders;
    const report = deleteDialogReport;
    if (!headers || !report) return;
    const operation = startLibraryOperation();
    if (!operation) return;
    setDeleteDialogError(null);
    try {
      await deleteSavedAnalyticsReport(headers, report.id);
      if (!isCurrentLibraryOperation(operation)) return;
      if (activeSavedReportId === report.id) setActiveSavedReportId(null);
      setDeleteDialogReport(null);
      setWorkspaceNotice(`Deleted "${report.name}".`);
      await reloadSavedReports(headers, operation.businessId);
    } catch (deleteError) {
      if (!isCurrentLibraryOperation(operation)) return;
      setDeleteDialogError(getRequestError(deleteError, 'Unable to delete this report.'));
    } finally {
      if (libraryOperationRef.current === operation.id) setLibraryBusy(false);
    }
  }

  async function saveNewVersion(): Promise<void> {
    const headers = activeBusinessHeaders;
    if (!headers || !activeSavedReportId || !plan) return;
    const operation = startLibraryOperation();
    if (!operation) return;
    try {
      const saved = await addSavedAnalyticsReportVersion(headers, activeSavedReportId, {
        plan,
        source: planSource,
      });
      if (!isCurrentLibraryOperation(operation)) return;
      setWorkspaceNotice(`Saved version ${saved.currentVersion} of "${saved.name}".`);
      await reloadSavedReports(headers, operation.businessId);
    } catch (saveError) {
      if (!isCurrentLibraryOperation(operation)) return;
      setError(getRequestError(saveError, 'Unable to save a new report version.'));
    } finally {
      if (libraryOperationRef.current === operation.id) setLibraryBusy(false);
    }
  }

  function beginRefinement(): void {
    setIsRefining(true);
    setPrompt('');
    setPromptError(null);
    setWorkspaceNotice('Describe only what you want to change. The current plan stays in context.');
    window.setTimeout(() => promptRef.current?.focus(), 0);
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
          activeBusinessHeaders && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSavedReportsOpen((open) => !open)}
                aria-expanded={savedReportsOpen}
                className={getActionClassName('secondary')}
              >
                <BookMarked aria-hidden="true" className="h-4 w-4" />
                Saved reports
                {savedReports.length > 0 && (
                  <span className="tabular-nums text-slate-500">{savedReports.length}</span>
                )}
              </button>
              {status !== 'idle' && (
                <button
                  type="button"
                  onClick={resetWorkspace}
                  disabled={isBusy}
                  className={getActionClassName('secondary')}
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  New question
                </button>
              )}
            </div>
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
        <SavedReportsPanel
          open={savedReportsOpen}
          reports={savedReports}
          status={savedReportsStatus}
          error={savedReportsError}
          activeReportId={activeSavedReportId}
          disabled={isBusy || libraryBusy}
          onClose={() => setSavedReportsOpen(false)}
          onLoad={loadSavedReport}
          onRename={openRenameReportDialog}
          onDuplicate={(report) => void duplicateReport(report)}
          onDelete={(report) => {
            setDeleteDialogReport(report);
            setDeleteDialogError(null);
          }}
          onRetry={() => void reloadSavedReports()}
        />
      )}

      {workspaceNotice && activeBusinessHeaders && (
        <InlineNotice tone="success">{workspaceNotice}</InlineNotice>
      )}

      {activeBusinessHeaders && (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          <section className="self-start overflow-hidden rounded-lg bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] xl:sticky xl:top-20">
            <div className="border-b border-white/10 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase text-blue-300">
                {isRefining ? 'Refinement' : 'Question'}
              </p>
              <h3 className="mt-1 text-lg font-bold">
                {isRefining ? 'What should change?' : 'What do you want to understand?'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {isRefining
                  ? 'The validated current plan remains in context. Describe only the adjustment.'
                  : 'Ask about revenue, margin, orders, products, channels, or inventory risk.'}
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

              {demoPresetQuestions.length > 0 && !isRefining && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Try one of these</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {demoPresetQuestions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setPrompt(question);
                          setPromptError(null);
                          promptRef.current?.focus();
                        }}
                        className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {promptError && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-300">
                  {promptError}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={isBusy || prompt.trim().length === 0}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {status === 'planning'
                    ? 'Interpreting...'
                    : isRefining
                      ? 'Review refinement'
                      : 'Review question'}
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

            {!isRefining && (
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
            )}
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

            {status === 'complete' && result && (
              <>
                <div className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={beginRefinement}
                    disabled={libraryBusy}
                    className={getActionClassName('secondary')}
                  >
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                    Refine report
                  </button>
                  {activeSavedReportId ? (
                    <button
                      type="button"
                      onClick={() => void saveNewVersion()}
                      disabled={libraryBusy}
                      className={getActionClassName('primary')}
                    >
                      <Save aria-hidden="true" className="h-4 w-4" />
                      Save new version
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openCreateReportDialog}
                      disabled={libraryBusy}
                      className={getActionClassName('primary')}
                    >
                      <Save aria-hidden="true" className="h-4 w-4" />
                      Save report
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      downloadAnalyticsCsv(result, {
                        businessName: activeBusiness?.name ?? 'TillTally business',
                        reportName: result.title,
                      })
                    }
                    className={getActionClassName('secondary')}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Export CSV
                  </button>
                  <p className="text-xs leading-5 text-slate-500 sm:ml-auto">
                    Export matches the exact table below.
                  </p>
                </div>
                <Suspense
                  fallback={
                    <StatePanel
                      className="mt-4"
                      minHeight="sm"
                      title="Preparing visualizations"
                      message="Building the interactive chart and exact-value table."
                    />
                  }
                >
                  <AnalyticsResultPanel key={result.meta.executedAt} result={result} />
                </Suspense>
              </>
            )}
          </section>
        </div>
      )}

      <SavedReportNameDialog
        open={nameDialogMode !== null}
        title={nameDialogMode === 'rename' ? 'Rename saved report' : 'Save this report'}
        description={
          nameDialogMode === 'rename'
            ? 'The report identity and version history stay unchanged.'
            : 'TillTally saves the validated plan, not executable code or an arbitrary prompt.'
        }
        submitLabel={nameDialogMode === 'rename' ? 'Rename report' : 'Save report'}
        value={reportName}
        busy={libraryBusy}
        error={nameDialogError}
        onChange={(value) => {
          setReportName(value);
          setNameDialogError(null);
        }}
        onCancel={() => {
          if (libraryBusy) return;
          setNameDialogMode(null);
          setNameDialogReport(null);
          setNameDialogError(null);
        }}
        onSubmit={() => void submitReportNameDialog()}
      />
      <SavedReportDeleteDialog
        report={deleteDialogReport}
        busy={libraryBusy}
        error={deleteDialogError}
        onCancel={() => {
          if (libraryBusy) return;
          setDeleteDialogReport(null);
          setDeleteDialogError(null);
        }}
        onConfirm={() => void removeReport()}
      />
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
