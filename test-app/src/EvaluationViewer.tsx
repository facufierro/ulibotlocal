import { useCallback, useEffect, useMemo, useState } from 'react'
import './evaluation-viewer.css'
import {
  LOCAL_BACKEND_URL,
  LOCAL_EVALUATION_ASSISTANT_ID,
  LOCAL_EVALUATION_DATASET_ID,
  LOCAL_SITE_TOKEN,
} from './localConfig'

type Metric = {
  name: string
  score: number | null
  passed: boolean
  reason: string | null
  error: string | null
}

type EvaluationResult = {
  id: number
  caseId: number
  input: string
  expectedOutput: string | null
  actualOutput: string | null
  scores: Metric[]
  passed: boolean
  error: string | null
  latencyMs: number | null
  totalTokens: number | null
  completedAt: string | null
}

type AssistantOption = {
  id: number
  tenantId: number
  type: string
  name: string
}

type AssistantMeta = {
  key: string
  value: string
}

type DatasetOption = {
  id: number
  name: string
  description: string | null
  active: boolean
}

type DatasetCase = {
  id: number
  datasetId: number
  name: string
  input: string
  expectedOutput: string | null
  retrievalContext: string[]
  expectedTools: string[]
  metadata: Record<string, unknown>
  sortOrder: number
  enabled: boolean
}

type DraftDatasetCase = {
  id: string
  name: string
  input: string
  expectedOutput: string
  retrievalContext: string
  expectedTools: string
  metadata: Record<string, unknown>
}

type ReportIssue = {
  caseId: number
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  explanation: string
  recommendedAction: string
}

type EvaluationReport = {
  status: string
  language: string
  verdict: string
  title: string
  overview: string
  issues: ReportIssue[]
  recommendation: string
}

type EvaluationSummary = {
  caseCount: number
  completedCount: number
  passedCount: number
  failedCount: number
  operationalErrorCount: number
  metricErrorCount: number
  passRate: number | null
  metricAverages: Record<string, number>
  averageLatencyMs: number | null
  totalTokens: number
}

type EvaluationRun = {
  id: string
  status: string
  assistantId: number
  datasetId: number
  promptSnapshot: string | null
  modelSnapshot: string | null
  judgeModel: string
  environment: string | null
  createdAt: string
  completedAt: string | null
  summary: EvaluationSummary | null
  report: EvaluationReport | null
  error: string | null
  results: EvaluationResult[]
}

type Filter = 'all' | 'failed' | 'passed'
type WorkspaceView = 'new' | 'datasets' | 'summary' | 'model' | 'prompt' | 'cases'
type RunRequest = {
  dataset_id: number
  judge_model: string
  candidate_prompt?: string
  baseline_run_id?: string
}

const metricLabels: Record<string, string> = {
  relevance: 'Relevancia',
  safety: 'Seguridad',
  correctness: 'Corrección',
  faithfulness: 'Fidelidad',
  tool_correctness: 'Uso de herramientas',
}

const judgeModelOptions = [
  { id: 'gpt-5-mini-2025-08-07', label: 'GPT-5 mini — predeterminado' },
  { id: 'gpt-4.1', label: 'GPT-4.1 — probado localmente' },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol — máxima calidad' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra — equilibrado' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna — rápido' },
] as const

const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value * 100)}%`

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

const createDraftCase = (values: Partial<DraftDatasetCase> = {}): DraftDatasetCase => ({
  id: crypto.randomUUID(),
  name: '',
  input: '',
  expectedOutput: '',
  retrievalContext: '',
  expectedTools: '',
  metadata: {},
  ...values,
})

const splitLines = (value: string) =>
  value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)

const splitTools = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean)

function EvaluationViewer() {
  const [backendUrl, setBackendUrl] = useState(LOCAL_BACKEND_URL)
  const [token, setToken] = useState(LOCAL_SITE_TOKEN)
  const [assistantId, setAssistantId] = useState(LOCAL_EVALUATION_ASSISTANT_ID)
  const [assistants, setAssistants] = useState<AssistantOption[]>([])
  const [datasets, setDatasets] = useState<DatasetOption[]>([])
  const [datasetId, setDatasetId] = useState(0)
  const [datasetCases, setDatasetCases] = useState<DatasetCase[]>([])
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState('')
  const [savedPrompt, setSavedPrompt] = useState('')
  const [draftPrompt, setDraftPrompt] = useState('')
  const [judgeModel, setJudgeModel] = useState('gpt-5-mini-2025-08-07')
  const [runs, setRuns] = useState<EvaluationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [run, setRun] = useState<EvaluationRun | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const [showConnection, setShowConnection] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [startingRun, setStartingRun] = useState(false)
  const [activeRunId, setActiveRunId] = useState('')
  const [activeCompletedCases, setActiveCompletedCases] = useState(0)
  const [runMessage, setRunMessage] = useState('')
  const [activeView, setActiveView] = useState<WorkspaceView>('new')
  const [datasetName, setDatasetName] = useState('')
  const [datasetDescription, setDatasetDescription] = useState('')
  const [draftDatasetCases, setDraftDatasetCases] = useState<DraftDatasetCase[]>(() => [
    createDraftCase(),
  ])
  const [savingDataset, setSavingDataset] = useState(false)
  const [datasetFormError, setDatasetFormError] = useState('')
  const [datasetMessage, setDatasetMessage] = useState('')
  const [datasetReadyToUse, setDatasetReadyToUse] = useState(false)

  const apiFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1${path}`, {
        ...options,
        headers: {
          'api-token': token,
          'x-client-host': 'localhost',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.detail || `Error ${response.status} al consultar la API`)
      }

      return response.json()
    },
    [backendUrl, token],
  )

  const loadRun = useCallback(
    async (runId: string) => {
      setError('')
      try {
        const detail = await apiFetch<EvaluationRun>(`/evaluations/${runId}`)
        setRun(detail)
        setSelectedRunId(runId)
      } catch (requestError) {
        setRun(null)
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la evaluación')
      }
    },
    [apiFetch],
  )

  const loadDataset = useCallback(
    async (selectedDatasetId: number) => {
      setDatasetId(selectedDatasetId)
      const cases = await apiFetch<DatasetCase[]>(
        `/evaluation-datasets/${selectedDatasetId}/cases`,
      )
      setDatasetCases(cases.filter((item) => item.enabled))
    },
    [apiFetch],
  )

  const loadAssistant = useCallback(
    async (selectedAssistantId: number) => {
      setAssistantId(selectedAssistantId)
      setError('')
      const [meta, history] = await Promise.all([
        apiFetch<AssistantMeta[]>(
          `/assistant-meta/${selectedAssistantId}/meta?meta=model,prompt,provider`,
        ),
        apiFetch<EvaluationRun[]>(
          `/assistants/${selectedAssistantId}/evaluations?limit=50`,
        ),
      ])
      const values = Object.fromEntries(meta.map((item) => [item.key, item.value]))
      const currentPrompt = values.prompt || ''
      setModel(values.model || '')
      setProvider(values.provider || '')
      setSavedPrompt(currentPrompt)
      setDraftPrompt(currentPrompt)
      setRuns(history)

      const latestCompleted = history.find((item) => item.status === 'COMPLETED')
      if (latestCompleted) {
        await loadRun(latestCompleted.id)
      } else {
        setRun(null)
        setSelectedRunId('')
      }
    },
    [apiFetch, loadRun],
  )

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      setInitializing(true)
      setError('')
      try {
        const [allAssistants, availableDatasets] = await Promise.all([
          apiFetch<AssistantOption[]>('/assistants'),
          apiFetch<DatasetOption[]>('/evaluation-datasets'),
        ])
        const supported = allAssistants.filter((item) =>
          ['openairesponses', 'langgraph'].includes(item.type),
        )
        const accessibleChecks = await Promise.all(
          supported.map(async (item) => {
            try {
              await apiFetch<EvaluationRun[]>(`/assistants/${item.id}/evaluations?limit=1`)
              return item
            } catch {
              return null
            }
          }),
        )
        const accessible = accessibleChecks.filter(
          (item): item is AssistantOption => item !== null,
        )
        if (!accessible.length) throw new Error('No hay asistentes evaluables asignados al sitio local.')
        if (cancelled) return

        setAssistants(accessible)
        setDatasets(availableDatasets)
        const initialAssistant =
          accessible.find((item) => item.id === LOCAL_EVALUATION_ASSISTANT_ID) || accessible[0]
        const initialDataset =
          availableDatasets.find((item) => item.id === LOCAL_EVALUATION_DATASET_ID) ||
          availableDatasets[0]
        await Promise.all([
          loadAssistant(initialAssistant.id),
          ...(initialDataset ? [loadDataset(initialDataset.id)] : []),
        ])
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar el evaluador')
        }
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void initialize()
    return () => { cancelled = true }
  }, [apiFetch, loadAssistant, loadDataset])

  const startEvaluation = async () => {
    if (!assistantId || !datasetId || !draftPrompt.trim() || !judgeModel.trim()) return
    setStartingRun(true)
    setError('')
    setRunMessage('Creando la evaluación…')
    try {
      const baseline = runs.find(
        (item) =>
          item.status === 'COMPLETED' &&
          item.datasetId === datasetId &&
          item.judgeModel === judgeModel.trim(),
      )
      const body: RunRequest = {
        dataset_id: datasetId,
        judge_model: judgeModel.trim(),
      }
      if (draftPrompt.trim() !== savedPrompt.trim()) body.candidate_prompt = draftPrompt.trim()
      if (baseline) body.baseline_run_id = baseline.id

      const created = await apiFetch<{ id: string; status: string }>(
        `/assistants/${assistantId}/evaluations`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      setRun(null)
      setActiveCompletedCases(0)
      setActiveRunId(created.id)
      setSelectedRunId(created.id)
      setRunMessage('Evaluación en curso. Puedes dejar esta pantalla abierta.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la evaluación')
      setRunMessage('')
    } finally {
      setStartingRun(false)
    }
  }

  const updateDraftDatasetCase = (
    caseId: string,
    field: keyof Omit<DraftDatasetCase, 'id' | 'metadata'>,
    value: string,
  ) => {
    setDraftDatasetCases((current) =>
      current.map((item) => item.id === caseId ? { ...item, [field]: value } : item),
    )
    setDatasetFormError('')
    setDatasetMessage('')
    setDatasetReadyToUse(false)
  }

  const addDraftDatasetCase = () => {
    setDraftDatasetCases((current) => [...current, createDraftCase()])
    setDatasetFormError('')
    setDatasetMessage('')
    setDatasetReadyToUse(false)
  }

  const removeDraftDatasetCase = (caseId: string) => {
    setDraftDatasetCases((current) => current.filter((item) => item.id !== caseId))
    setDatasetFormError('')
    setDatasetMessage('')
    setDatasetReadyToUse(false)
  }

  const importDatasetFile = async (file: File) => {
    setDatasetFormError('')
    setDatasetMessage('')
    setDatasetReadyToUse(false)
    try {
      const rawDataset: unknown = JSON.parse(await file.text())
      if (!rawDataset || typeof rawDataset !== 'object' || Array.isArray(rawDataset)) {
        throw new Error('El archivo debe contener un objeto JSON de dataset.')
      }
      const parsed = rawDataset as Record<string, unknown>
      if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
        throw new Error('El archivo debe incluir un arreglo "cases" con al menos un caso.')
      }

      const importedCases = parsed.cases.map((rawCase, index) => {
        if (!rawCase || typeof rawCase !== 'object') {
          throw new Error(`El caso ${index + 1} no tiene un formato válido.`)
        }
        const item = rawCase as Record<string, unknown>
        const expectedOutput = item.expected_output ?? item.expectedOutput
        const retrievalContext = item.retrieval_context ?? item.retrievalContext
        const expectedTools = item.expected_tools ?? item.expectedTools
        const metadata = item.metadata

        return createDraftCase({
          name: typeof item.name === 'string' ? item.name : `caso-${index + 1}`,
          input: typeof item.input === 'string' ? item.input : '',
          expectedOutput: typeof expectedOutput === 'string' ? expectedOutput : '',
          retrievalContext: Array.isArray(retrievalContext)
            ? retrievalContext.filter((value): value is string => typeof value === 'string').join('\n')
            : typeof retrievalContext === 'string' ? retrievalContext : '',
          expectedTools: Array.isArray(expectedTools)
            ? expectedTools.filter((value): value is string => typeof value === 'string').join(', ')
            : typeof expectedTools === 'string' ? expectedTools : '',
          metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? metadata as Record<string, unknown>
            : {},
        })
      })

      setDatasetName(typeof parsed.name === 'string' ? parsed.name : '')
      setDatasetDescription(typeof parsed.description === 'string' ? parsed.description : '')
      setDraftDatasetCases(importedCases)
      setDatasetMessage(`${importedCases.length} casos importados. Revísalos antes de guardar.`)
    } catch (importError) {
      setDatasetFormError(
        importError instanceof Error ? importError.message : 'No se pudo leer el archivo JSON.',
      )
    }
  }

  const duplicateSelectedDataset = async () => {
    const sourceDataset = datasets.find((item) => item.id === datasetId)
    if (!sourceDataset) return
    setDatasetFormError('')
    setDatasetMessage('')
    setDatasetReadyToUse(false)
    try {
      const cases = await apiFetch<DatasetCase[]>(
        `/evaluation-datasets/${sourceDataset.id}/cases`,
      )
      setDatasetName(`${sourceDataset.name} - copia`)
      setDatasetDescription(sourceDataset.description || '')
      setDraftDatasetCases(cases.map((item) => createDraftCase({
        name: item.name,
        input: item.input,
        expectedOutput: item.expectedOutput || '',
        retrievalContext: item.retrievalContext.join('\n'),
        expectedTools: item.expectedTools.join(', '),
        metadata: item.metadata,
      })))
      setDatasetMessage(`${cases.length} casos copiados. Cambia el nombre y revisa el contenido.`)
    } catch (requestError) {
      setDatasetFormError(
        requestError instanceof Error ? requestError.message : 'No se pudo duplicar el dataset.',
      )
    }
  }

  const saveDataset = async () => {
    const normalizedName = datasetName.trim()
    if (!normalizedName) {
      setDatasetFormError('Escribe un nombre para el dataset.')
      return
    }
    if (normalizedName.length > 191) {
      setDatasetFormError('El nombre del dataset no puede superar los 191 caracteres.')
      return
    }
    if (draftDatasetCases.length === 0) {
      setDatasetFormError('Agrega al menos un caso de evaluación.')
      return
    }
    const incompleteIndex = draftDatasetCases.findIndex(
      (item) => !item.name.trim() || !item.input.trim() || !item.expectedOutput.trim(),
    )
    if (incompleteIndex >= 0) {
      setDatasetFormError(
        `Completa el nombre, la pregunta y la respuesta esperada del caso ${incompleteIndex + 1}.`,
      )
      return
    }
    const longNameIndex = draftDatasetCases.findIndex((item) => item.name.trim().length > 191)
    if (longNameIndex >= 0) {
      setDatasetFormError(`El nombre del caso ${longNameIndex + 1} supera los 191 caracteres.`)
      return
    }
    const normalizedCaseNames = draftDatasetCases.map((item) => item.name.trim().toLowerCase())
    if (new Set(normalizedCaseNames).size !== normalizedCaseNames.length) {
      setDatasetFormError('Cada caso debe tener un nombre diferente.')
      return
    }

    setSavingDataset(true)
    setDatasetFormError('')
    setDatasetMessage('Guardando dataset y casos…')
    setDatasetReadyToUse(false)
    let createdDataset: DatasetOption | null = null
    let savedCaseCount = 0
    try {
      createdDataset = await apiFetch<DatasetOption>('/evaluation-datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: normalizedName,
          description: datasetDescription.trim() || null,
        }),
      })

      for (const [index, item] of draftDatasetCases.entries()) {
        await apiFetch<DatasetCase>(`/evaluation-datasets/${createdDataset.id}/cases`, {
          method: 'POST',
          body: JSON.stringify({
            name: item.name.trim(),
            input: item.input.trim(),
            expected_output: item.expectedOutput.trim(),
            retrieval_context: splitLines(item.retrievalContext),
            expected_tools: splitTools(item.expectedTools),
            metadata: item.metadata,
            sort_order: index,
          }),
        })
        savedCaseCount += 1
      }

      const refreshedDatasets = await apiFetch<DatasetOption[]>('/evaluation-datasets')
      setDatasets(refreshedDatasets)
      await loadDataset(createdDataset.id)
      setDatasetName('')
      setDatasetDescription('')
      setDraftDatasetCases([createDraftCase()])
      setDatasetMessage(
        `Dataset "${createdDataset.name}" creado con ${savedCaseCount} casos y seleccionado para evaluar.`,
      )
      setDatasetReadyToUse(true)
    } catch (requestError) {
      if (createdDataset) {
        const refreshedDatasets = await apiFetch<DatasetOption[]>('/evaluation-datasets').catch(() => [])
        if (refreshedDatasets.length) setDatasets(refreshedDatasets)
        await loadDataset(createdDataset.id).catch(() => undefined)
        setDatasetFormError(
          `El dataset se creó, pero solo se guardaron ${savedCaseCount} de ${draftDatasetCases.length} casos. ` +
          'Revisa la conexión antes de continuar.',
        )
      } else {
        setDatasetFormError(
          requestError instanceof Error ? requestError.message : 'No se pudo crear el dataset.',
        )
      }
      setDatasetMessage('')
    } finally {
      setSavingDataset(false)
    }
  }

  useEffect(() => {
    if (!activeRunId) return
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      try {
        const detail = await apiFetch<EvaluationRun>(`/evaluations/${activeRunId}`)
        if (cancelled) return
        setActiveCompletedCases(detail.results.filter((item) => item.completedAt).length)
        if (detail.status === 'COMPLETED') {
          setRun(detail)
          setActiveView('summary')
          setActiveRunId('')
          setRunMessage('Evaluación terminada. El informe completo está listo.')
          const history = await apiFetch<EvaluationRun[]>(
            `/assistants/${assistantId}/evaluations?limit=50`,
          )
          if (!cancelled) setRuns(history)
          return
        }
        if (detail.status === 'FAILED') {
          setRun(detail)
          setActiveRunId('')
          setRunMessage('')
          setError(detail.error || 'La evaluación falló.')
          return
        }
        timer = window.setTimeout(() => void poll(), 3000)
      } catch (requestError) {
        if (!cancelled) {
          setActiveRunId('')
          setRunMessage('')
          setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar el progreso')
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [activeRunId, apiFetch, assistantId])

  const visibleResults = useMemo(() => {
    if (!run) return []
    if (filter === 'failed') return run.results.filter((result) => !result.passed)
    if (filter === 'passed') return run.results.filter((result) => result.passed)
    return run.results
  }, [filter, run])

  const summary = run?.summary
  const report = run?.report
  const promptIssues = useMemo(() => {
    if (!run || !report) return []
    return report.issues.filter((issue) => {
      const result = run.results.find((item) => item.caseId === issue.caseId)
      return Boolean(
        result &&
        !result.error &&
        result.scores.some((metric) => !metric.passed && !metric.error),
      )
    })
  }, [report, run])
  const technicalIssues = useMemo(() => {
    if (!report) return []
    const promptIssueKeys = new Set(promptIssues.map((issue) => `${issue.caseId}:${issue.title}`))
    return report.issues.filter(
      (issue) => !promptIssueKeys.has(`${issue.caseId}:${issue.title}`),
    )
  }, [promptIssues, report])
  const promptWordCount = run?.promptSnapshot?.trim()
    ? run.promptSnapshot.trim().split(/\s+/).length
    : 0
  const selectedAssistant = assistants.find((item) => item.id === assistantId)
  const selectedDataset = datasets.find((item) => item.id === datasetId)
  const draftChanged = draftPrompt.trim() !== savedPrompt.trim()
  const selectedJudgePreset = judgeModelOptions.some((item) => item.id === judgeModel)
    ? judgeModel
    : 'custom'

  const copyPrompt = async () => {
    if (!run?.promptSnapshot) return
    await navigator.clipboard.writeText(run.promptSnapshot)
    setPromptCopied(true)
    window.setTimeout(() => setPromptCopied(false), 1600)
  }

  return (
    <main className="evaluation-viewer">
      <header className="viewer-header">
        <div>
          <h1>Tool de evaluacion de asistentes</h1>
        </div>
        <div className="header-actions">
          <a className="secondary-button" href="/">Volver al chatbot</a>
          <button className="secondary-button" onClick={() => setShowConnection(!showConnection)}>
            Configuración
          </button>
        </div>
      </header>

      {showConnection && (
        <section className="connection-panel" aria-label="Configuración local">
          <label>
            Backend local
            <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          </label>
          <label>
            Token local
            <input type="password" value={token} onChange={(event) => setToken(event.target.value)} />
          </label>
          <label>
            Host de autenticación
            <input value="localhost" disabled />
          </label>
          <button onClick={() => window.location.reload()}>Reconectar</button>
          <p>Esta pantalla consulta únicamente tu backend local.</p>
        </section>
      )}

      {error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>No se pudieron cargar los resultados.</strong>
            <span>{error}</span>
          </div>
          <button onClick={() => window.location.reload()}>Reintentar</button>
        </section>
      )}

      {initializing && <div className="loading-state">Preparando el evaluador local…</div>}

      {!initializing && assistants.length > 0 && (
        <div className="evaluation-workspace">
          <aside className="evaluation-sidebar">
            <div className="sidebar-title">
              <span>Evaluaciones</span>
              <small>{selectedAssistant?.name || 'Asistente local'}</small>
            </div>

            <button
              className={`sidebar-new ${activeView === 'new' ? 'active' : ''}`}
              onClick={() => setActiveView('new')}
            >
              <span>+</span> Nueva evaluación
            </button>

            <button
              className={`sidebar-datasets ${activeView === 'datasets' ? 'active' : ''}`}
              onClick={() => setActiveView('datasets')}
            >
              <span>▦</span> Crear dataset
            </button>

            <div className="sidebar-group">
              <span className="sidebar-label">RESULTADO SELECCIONADO</span>
              <button disabled={!run} className={activeView === 'summary' ? 'active' : ''} onClick={() => setActiveView('summary')}>
                <span>Resumen</span><b>{run?.summary ? percent(run.summary.passRate) : '—'}</b>
              </button>
              <button disabled={!run} className={activeView === 'model' ? 'active' : ''} onClick={() => setActiveView('model')}>
                <span>Modelo</span><b>{run?.modelSnapshot ? '›' : '—'}</b>
              </button>
              <button disabled={!run} className={activeView === 'prompt' ? 'active' : ''} onClick={() => setActiveView('prompt')}>
                <span>Prompt</span><b>{run ? promptIssues.length : '—'}</b>
              </button>
              <button disabled={!run} className={activeView === 'cases' ? 'active' : ''} onClick={() => setActiveView('cases')}>
                <span>Casos</span><b>{run?.results.length ?? '—'}</b>
              </button>
            </div>

            <div className="sidebar-history">
              <span className="sidebar-label">HISTORIAL</span>
              {activeRunId && (
                <div className="history-running"><span /> Evaluación en curso</div>
              )}
              {runs.length === 0 && <p>Todavía no hay resultados.</p>}
              {runs.map((item) => (
                <button
                  key={item.id}
                  className={
                    selectedRunId === item.id &&
                    ['summary', 'model', 'prompt', 'cases'].includes(activeView)
                      ? 'selected'
                      : ''
                  }
                  onClick={() => {
                    setActiveView('summary')
                    void loadRun(item.id)
                  }}
                >
                  <span>{formatDate(item.createdAt)}</span>
                  <small>{item.modelSnapshot || 'Sin modelo'} · {item.summary ? percent(item.summary.passRate) : item.status}</small>
                </button>
              ))}
            </div>
          </aside>

          <div className="evaluation-content">
      {activeView === 'datasets' && (
        <section className="panel dataset-manager">
          <div className="dataset-manager-heading">
            <div>
              <p className="eyebrow">DATASETS DE EVALUACIÓN</p>
              <h2>Crear un dataset</h2>
              <p>
                Define preguntas verificables y la respuesta que debería producir el asistente.
                El dataset se guarda únicamente en el backend local.
              </p>
            </div>
            <span className="count-badge">{datasets.length} guardados</span>
          </div>

          <div className="dataset-tools">
            <button
              disabled={!selectedDataset || savingDataset}
              onClick={() => void duplicateSelectedDataset()}
            >
              Duplicar dataset seleccionado
            </button>
            <label className={`secondary-button file-button ${savingDataset ? 'disabled' : ''}`}>
              Importar JSON
              <input
                type="file"
                accept=".json,application/json"
                disabled={savingDataset}
                onChange={(event) => {
                  const input = event.currentTarget
                  const file = input.files?.[0]
                  if (file) void importDatasetFile(file)
                  input.value = ''
                }}
              />
            </label>
          </div>

          {datasetFormError && (
            <div className="dataset-form-message error" role="alert">{datasetFormError}</div>
          )}
          {datasetMessage && (
            <div className="dataset-form-message success" role="status">
              <span>{datasetMessage}</span>
              {datasetId > 0 && datasetReadyToUse && (
                <button className="text-button" onClick={() => setActiveView('new')}>
                  Usar en una evaluación
                </button>
              )}
            </div>
          )}

          <div className="dataset-details-grid">
            <label>
              <span>Nombre del dataset <b>*</b></span>
              <input
                value={datasetName}
                maxLength={191}
                disabled={savingDataset}
                onChange={(event) => {
                  setDatasetName(event.target.value)
                  setDatasetFormError('')
                  setDatasetMessage('')
                  setDatasetReadyToUse(false)
                }}
                placeholder="Ejemplo: Soporte GLPI — regresión v2"
              />
            </label>
            <label>
              <span>Descripción</span>
              <input
                value={datasetDescription}
                disabled={savingDataset}
                onChange={(event) => {
                  setDatasetDescription(event.target.value)
                  setDatasetFormError('')
                  setDatasetMessage('')
                  setDatasetReadyToUse(false)
                }}
                placeholder="Qué cubren estos casos y de dónde provienen"
              />
            </label>
          </div>

          <div className="dataset-cases-heading">
            <div>
              <h3>Casos de evaluación</h3>
              <p>La pregunta y la respuesta esperada deben ser concretas y comprobables.</p>
            </div>
            <button disabled={savingDataset} onClick={addDraftDatasetCase}>+ Agregar caso</button>
          </div>

          {draftDatasetCases.length === 0 && (
            <div className="dataset-empty-cases">
              No hay casos. Agrega uno o importa un archivo JSON.
            </div>
          )}

          <div className="dataset-case-editors">
            {draftDatasetCases.map((item, index) => (
              <article className="dataset-case-editor" key={item.id}>
                <div className="dataset-case-heading">
                  <span className="case-number">{index + 1}</span>
                  <label>
                    <span>Nombre interno del caso <b>*</b></span>
                    <input
                      value={item.name}
                      maxLength={191}
                      disabled={savingDataset}
                      onChange={(event) =>
                        updateDraftDatasetCase(item.id, 'name', event.target.value)
                      }
                      placeholder="Ejemplo: error-login-500"
                    />
                  </label>
                  <button
                    className="remove-case-button"
                    disabled={savingDataset}
                    onClick={() => removeDraftDatasetCase(item.id)}
                    aria-label={`Eliminar caso ${index + 1}`}
                  >
                    Eliminar
                  </button>
                </div>

                <div className="dataset-answer-grid">
                  <label>
                    <span>Pregunta del usuario <b>*</b></span>
                    <textarea
                      value={item.input}
                      disabled={savingDataset}
                      onChange={(event) =>
                        updateDraftDatasetCase(item.id, 'input', event.target.value)
                      }
                      placeholder="La consulta real que recibirá el asistente"
                    />
                  </label>
                  <label>
                    <span>Respuesta esperada <b>*</b></span>
                    <textarea
                      value={item.expectedOutput}
                      disabled={savingDataset}
                      onChange={(event) =>
                        updateDraftDatasetCase(item.id, 'expectedOutput', event.target.value)
                      }
                      placeholder="Qué debe responder para que el caso sea correcto"
                    />
                  </label>
                </div>

                <details className="dataset-case-options">
                  <summary>Contexto y herramientas esperadas</summary>
                  <div>
                    <label>
                      <span>Contexto documental</span>
                      <textarea
                        value={item.retrievalContext}
                        disabled={savingDataset}
                        onChange={(event) =>
                          updateDraftDatasetCase(item.id, 'retrievalContext', event.target.value)
                        }
                        placeholder="Un fragmento recuperado por línea"
                      />
                    </label>
                    <label>
                      <span>Herramientas esperadas</span>
                      <input
                        value={item.expectedTools}
                        disabled={savingDataset}
                        onChange={(event) =>
                          updateDraftDatasetCase(item.id, 'expectedTools', event.target.value)
                        }
                        placeholder="gdrivesearch, glpi_create_ticket"
                      />
                      <small>Sepáralas con comas. Déjalo vacío si no debe invocar herramientas.</small>
                    </label>
                  </div>
                </details>
              </article>
            ))}
          </div>

          <div className="dataset-save-bar">
            <div>
              <strong>{draftDatasetCases.length} casos preparados</strong>
              <span>Se guardarán como un dataset nuevo; no se modifica ninguno existente.</span>
            </div>
            <button
              className="run-button"
              disabled={savingDataset}
              onClick={() => void saveDataset()}
            >
              {savingDataset ? 'Guardando…' : 'Crear dataset'}
            </button>
          </div>
        </section>
      )}

      {activeView === 'new' && (
        <section className="evaluation-builder">
          <div className="builder-heading">
            <div>
              <p className="eyebrow">NUEVA EVALUACIÓN</p>
              <h2>Configura la prueba</h2>
              <p>El prompt editado se usa solo para esta ejecución y nunca modifica el asistente.</p>
            </div>
            <span className="local-badge">Solo local</span>
          </div>

          <div className="selection-grid">
            <label className="selection-card">
              <span className="step-label"><b>1</b> Asistente</span>
              <select
                value={assistantId}
                disabled={Boolean(activeRunId)}
                onChange={(event) => void loadAssistant(Number(event.target.value))}
              >
                {assistants.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} (ID {item.id})</option>
                ))}
              </select>
              <span className="selection-detail">
                <strong>{model || 'Modelo sin configurar'}</strong>
                {provider && ` · ${provider}`} · {selectedAssistant?.type}
              </span>
            </label>

            <label className="selection-card">
              <span className="step-label"><b>2</b> Dataset</span>
              <select
                value={datasetId}
                disabled={Boolean(activeRunId) || datasets.length === 0}
                onChange={(event) => void loadDataset(Number(event.target.value))}
              >
                {datasets.length === 0 && <option value={0}>Crea un dataset primero</option>}
                {datasets.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <span className="selection-detail">
                <strong>{datasetCases.length} casos</strong>
                {selectedDataset?.description && ` · ${selectedDataset.description}`}
              </span>
            </label>

            <label className="selection-card judge-card">
              <span className="step-label"><b>3</b> Modelo juez</span>
              <select
                value={selectedJudgePreset}
                disabled={Boolean(activeRunId)}
                onChange={(event) =>
                  setJudgeModel(event.target.value === 'custom' ? '' : event.target.value)
                }
              >
                {judgeModelOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
                <option value="custom">Otro modelo…</option>
              </select>
              {selectedJudgePreset === 'custom' && (
                <input
                  value={judgeModel}
                  disabled={Boolean(activeRunId)}
                  onChange={(event) => setJudgeModel(event.target.value)}
                  placeholder="ID del modelo, por ejemplo gpt-4.1"
                  aria-label="ID personalizado del modelo juez"
                />
              )}
              <span className="selection-detail">Califica las respuestas; no reemplaza al modelo evaluado.</span>
            </label>
          </div>

          <div className="prompt-editor">
            <div className="prompt-editor-header">
              <div>
                <span className="step-label"><b>4</b> Prompt que se evaluará</span>
                <span className={`prompt-state ${draftChanged ? 'changed' : ''}`}>
                  {draftChanged ? 'Versión editada (no guardada)' : 'Prompt actual del asistente'}
                </span>
              </div>
              <div>
                <span>{draftPrompt.trim() ? draftPrompt.trim().split(/\s+/).length : 0} palabras</span>
                <button
                  className="text-button"
                  disabled={!draftChanged || Boolean(activeRunId)}
                  onClick={() => setDraftPrompt(savedPrompt)}
                >
                  Restablecer
                </button>
              </div>
            </div>
            <textarea
              value={draftPrompt}
              disabled={Boolean(activeRunId)}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="Este asistente no tiene un prompt configurado."
              spellCheck="false"
            />
          </div>

          <div className="run-action">
            <div>
              <strong>{datasetCases.length} casos · {model || 'modelo no configurado'}</strong>
              <span>
                {draftChanged
                  ? 'Se evaluará la versión editada sin guardarla.'
                  : 'Se evaluará el prompt actual del asistente.'}
              </span>
            </div>
            <button
              className="run-button"
              disabled={startingRun || Boolean(activeRunId) || !draftPrompt.trim() || !datasetCases.length}
              onClick={() => void startEvaluation()}
            >
              {startingRun ? 'Iniciando…' : activeRunId ? 'Evaluando…' : 'Ejecutar evaluación'}
            </button>
          </div>

          {(activeRunId || runMessage) && (
            <div className={`run-progress ${activeRunId ? 'running' : 'finished'}`}>
              <div className="progress-copy">
                <span className="progress-indicator" />
                <div>
                  <strong>{activeRunId ? 'Evaluación en curso' : 'Evaluación terminada'}</strong>
                  <span>{runMessage}</span>
                </div>
                {activeRunId && <b>{activeCompletedCases}/{datasetCases.length}</b>}
              </div>
              {activeRunId && (
                <div className="progress-track">
                  <span style={{ width: `${datasetCases.length ? (activeCompletedCases / datasetCases.length) * 100 : 0}%` }} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeView !== 'new' && !run && (
        <section className="empty-result">
          <strong>No hay una evaluación seleccionada.</strong>
          <span>Elige una del historial o crea una nueva.</span>
        </section>
      )}

      {run && activeView !== 'new' && (
        <>
          <section className="run-toolbar">
            <div className="selected-run-heading">
              <span className="sidebar-label">EVALUACIÓN SELECCIONADA</span>
              <strong>{formatDate(run.createdAt)} · {run.status}</strong>
            </div>
            <div className="run-meta">
              <span>Modelo <strong>{run.modelSnapshot || '—'}</strong></span>
              <span>Juez <strong>{run.judgeModel}</strong></span>
              <span>Finalizada <strong>{formatDate(run.completedAt)}</strong></span>
            </div>
          </section>

          {activeView === 'summary' && (
            <>
          <section className={`verdict-card ${report?.verdict === 'NOT_APPROVED' ? 'not-approved' : 'approved'}`}>
            <div className="verdict-main">
              <span className="verdict-icon" aria-hidden="true">
                {report?.verdict === 'NOT_APPROVED' ? '!' : '✓'}
              </span>
              <div>
                <p className="eyebrow">VEREDICTO</p>
                <h2>{report?.title || run.status}</h2>
                <p>{report?.overview || 'La evaluación no generó un informe narrativo.'}</p>
              </div>
            </div>
            <div className="pass-rate">
              <strong>{percent(summary?.passRate)}</strong>
              <span>{summary?.passedCount ?? 0} de {summary?.caseCount ?? 0} casos aprobados</span>
            </div>
          </section>

          {summary && (
            <section className="summary-grid" aria-label="Métricas principales">
              <article>
                <span>Casos aprobados</span>
                <strong>{summary.passedCount}/{summary.caseCount}</strong>
              </article>
              <article>
                <span>Fallos estrictos</span>
                <strong>{summary.failedCount}</strong>
              </article>
              <article>
                <span>Errores de métricas</span>
                <strong>{summary.metricErrorCount}</strong>
              </article>
              <article>
                <span>Latencia media</span>
                <strong>{summary.averageLatencyMs == null ? '—' : `${(summary.averageLatencyMs / 1000).toFixed(1)} s`}</strong>
              </article>
              <article>
                <span>Tokens totales</span>
                <strong>{summary.totalTokens.toLocaleString('es-AR')}</strong>
              </article>
            </section>
          )}
            </>
          )}

          {activeView === 'model' && summary && (
            <section className="panel model-evaluation" id="model-evaluation">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">MODELO EVALUADO</p>
                  <h2>{run.modelSnapshot || 'Modelo no identificado'}</h2>
                  <p>
                    Este modelo generó las respuestas usando el prompt y el contexto documental
                    guardados en esta ejecución. <strong>{run.judgeModel}</strong> actuó como juez.
                  </p>
                </div>
                <div className="model-score">
                  <strong>{percent(summary.passRate)}</strong>
                  <span>resultado de la configuración</span>
                </div>
              </div>
              <div className="scope-note">
                <strong>Alcance de esta medición</strong>
                <span>
                  Mide las respuestas producidas por este modelo con el prompt y los documentos de
                  la ejecución. No aísla la capacidad del modelo base. Una comparación real entre
                  modelos requiere repetir estos mismos 20 casos sin cambiar prompt, contexto ni juez.
                </span>
              </div>
              <div className="model-facts">
                <article><span>Respuestas evaluadas</span><strong>{summary.completedCount}</strong></article>
                <article><span>Respuestas aprobadas</span><strong>{summary.passedCount}</strong></article>
                <article><span>Latencia media</span><strong>{summary.averageLatencyMs == null ? '—' : `${(summary.averageLatencyMs / 1000).toFixed(1)} s`}</strong></article>
                <article><span>Tokens utilizados</span><strong>{summary.totalTokens.toLocaleString('es-AR')}</strong></article>
              </div>
              <h3 className="metric-title">Puntuación de sus respuestas</h3>
              <div className="metric-bars">
                {Object.entries(summary.metricAverages).map(([name, score]) => (
                  <div className="metric-row" key={name}>
                    <span>{metricLabels[name] || name}</span>
                    <div className="bar-track"><span style={{ width: `${score * 100}%` }} /></div>
                    <strong>{percent(score)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeView === 'prompt' && (
          <section className="panel prompt-evaluation" id="prompt-evaluation">
            <div className="section-heading prompt-heading">
              <div>
                <p className="eyebrow">PROMPT EVALUADO</p>
                <h2>Instrucciones usadas por el asistente</h2>
                <p>
                  Este es el snapshot exacto guardado al iniciar la evaluación. Los cambios
                  posteriores al asistente no alteran este resultado.
                </p>
              </div>
              <button disabled={!run.promptSnapshot} onClick={() => void copyPrompt()}>
                {promptCopied ? 'Copiado' : 'Copiar prompt'}
              </button>
            </div>

            <div className="prompt-summary">
              <article>
                <span>Extensión</span>
                <strong>{promptWordCount.toLocaleString('es-AR')} palabras</strong>
              </article>
              <article>
                <span>Fallos accionables</span>
                <strong>{promptIssues.length}</strong>
              </article>
              <article>
                <span>Errores técnicos excluidos</span>
                <strong>{technicalIssues.length}</strong>
              </article>
              <article>
                <span>Recomendación</span>
                <strong>{report?.verdict === 'NOT_APPROVED' ? 'Revisar antes de publicar' : 'Aprobado'}</strong>
              </article>
            </div>

            <div className="prompt-snapshot" aria-label="Texto completo del prompt evaluado">
              <div className="prompt-snapshot-header">
                <span>Prompt completo</span>
                <code>run.promptSnapshot</code>
              </div>
              <pre>{run.promptSnapshot || 'Esta ejecución no contiene un snapshot del prompt.'}</pre>
            </div>

            <div className="prompt-findings">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">QUÉ CORREGIR</p>
                  <h2>Hallazgos accionables del prompt</h2>
                  <p>
                    Solo se incluyen fallos de calidad. Los timeouts del juez aparecen aparte y no
                    se presentan como problemas del prompt.
                  </p>
                </div>
                <span className="count-badge">{promptIssues.length}</span>
              </div>

              {promptIssues.length === 0 && (
                <div className="empty-finding">No se detectaron fallos de calidad atribuibles a las instrucciones.</div>
              )}

              <div className="issues-list">
                {promptIssues.map((issue) => {
                  const result = run.results.find((item) => item.caseId === issue.caseId)
                  return (
                    <article key={`${issue.caseId}-${issue.title}`} className="issue-card prompt-issue">
                      <div className="issue-topline">
                        <span className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                        <span>Caso {issue.caseId}</span>
                      </div>
                      <h3>{issue.title}</h3>
                      <p>{issue.explanation}</p>
                      <div className="recommendation"><strong>Cambio recomendado</strong>{issue.recommendedAction}</div>
                      {result && (
                        <details className="issue-evidence">
                          <summary>Ver evidencia del fallo</summary>
                          <div>
                            <span>Pregunta</span>
                            <p>{result.input}</p>
                            <span>Esperado</span>
                            <p>{result.expectedOutput || 'No definido'}</p>
                            <span>Respuesta real</span>
                            <p>{result.actualOutput || 'Sin respuesta'}</p>
                          </div>
                        </details>
                      )}
                    </article>
                  )
                })}
              </div>

              {technicalIssues.length > 0 && (
                <details className="technical-issues">
                  <summary>{technicalIssues.length} incidencias técnicas excluidas de la evaluación del prompt</summary>
                  <div>
                    {technicalIssues.map((issue) => (
                      <article key={`${issue.caseId}-${issue.title}`}>
                        <strong>Caso {issue.caseId}: {issue.title}</strong>
                        <p>{issue.explanation}</p>
                      </article>
                    ))}
                  </div>
                </details>
              )}

              <div className="final-recommendation">
                <strong>Decisión sobre este prompt</strong>
                <p>{report?.recommendation || 'El informe no contiene una recomendación final.'}</p>
              </div>
            </div>
          </section>
          )}

          {activeView === 'cases' && (
          <section className="panel cases-panel">
            <div className="section-heading cases-heading">
              <div>
                <p className="eyebrow">EVIDENCIA</p>
                <h2>Respuestas reales</h2>
                <p>Abre cualquier caso para comparar la pregunta, lo esperado y la respuesta del modelo.</p>
              </div>
              <div className="filter-buttons" role="group" aria-label="Filtrar casos">
                <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                  Todos ({run.results.length})
                </button>
                <button className={filter === 'failed' ? 'active' : ''} onClick={() => setFilter('failed')}>
                  Fallidos ({run.results.filter((item) => !item.passed).length})
                </button>
                <button className={filter === 'passed' ? 'active' : ''} onClick={() => setFilter('passed')}>
                  Aprobados ({run.results.filter((item) => item.passed).length})
                </button>
              </div>
            </div>

            <div className="case-list">
              {visibleResults.map((result) => (
                <details className={`case-card ${result.passed ? 'case-passed' : 'case-failed'}`} key={result.id}>
                  <summary>
                    <span className="case-status" aria-hidden="true">{result.passed ? '✓' : '×'}</span>
                    <span className="case-title">
                      <strong>Caso {result.caseId}</strong>
                      <span>{result.input}</span>
                    </span>
                    <span className="case-stats">
                      {result.latencyMs != null && `${(result.latencyMs / 1000).toFixed(1)} s`}
                      {result.totalTokens != null && ` · ${result.totalTokens.toLocaleString('es-AR')} tokens`}
                    </span>
                  </summary>
                  <div className="case-content">
                    {result.error && <div className="case-error"><strong>Error de ejecución</strong>{result.error}</div>}
                    <div className="response-grid">
                      <section>
                        <span className="content-label">Pregunta</span>
                        <p>{result.input}</p>
                      </section>
                      <section>
                        <span className="content-label">Respuesta esperada</span>
                        <p>{result.expectedOutput || 'No definida'}</p>
                      </section>
                      <section className="actual-response">
                        <span className="content-label">Respuesta real del asistente</span>
                        <p>{result.actualOutput || 'Sin respuesta'}</p>
                      </section>
                    </div>
                    <div className="score-list">
                      {result.scores.map((metric) => (
                        <details className={`score ${metric.passed ? 'score-passed' : 'score-failed'}`} key={metric.name}>
                          <summary>
                            <span>{metricLabels[metric.name] || metric.name}</span>
                            <strong>{metric.error ? 'ERROR' : percent(metric.score)}</strong>
                          </summary>
                          {(metric.reason || metric.error) && <p>{metric.error || metric.reason}</p>}
                        </details>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
          )}

          <footer>
            <span>Run ID: {run.id}</span>
            <span>Datos obtenidos del backend local</span>
          </footer>
        </>
      )}
          </div>
        </div>
      )}
    </main>
  )
}

export default EvaluationViewer
