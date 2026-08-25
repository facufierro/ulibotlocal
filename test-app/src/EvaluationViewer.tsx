import { useCallback, useEffect, useMemo, useState } from 'react'
import './evaluation-viewer.css'
import {
  LOCAL_BACKEND_URL,
  LOCAL_EVALUATION_ASSISTANT_ID,
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

const metricLabels: Record<string, string> = {
  relevance: 'Relevancia',
  safety: 'Seguridad',
  correctness: 'Corrección',
  faithfulness: 'Fidelidad',
  tool_correctness: 'Uso de herramientas',
}

const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value * 100)}%`

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—'

function EvaluationViewer() {
  const [backendUrl, setBackendUrl] = useState(LOCAL_BACKEND_URL)
  const [token, setToken] = useState(LOCAL_SITE_TOKEN)
  const [assistantId, setAssistantId] = useState(LOCAL_EVALUATION_ASSISTANT_ID)
  const [runs, setRuns] = useState<EvaluationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [run, setRun] = useState<EvaluationRun | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConnection, setShowConnection] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const apiFetch = useCallback(
    async <T,>(path: string): Promise<T> => {
      const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1${path}`, {
        headers: {
          'api-token': token,
          'x-client-host': 'localhost',
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
      setLoading(true)
      setError('')
      try {
        const detail = await apiFetch<EvaluationRun>(`/evaluations/${runId}`)
        setRun(detail)
        setSelectedRunId(runId)
      } catch (requestError) {
        setRun(null)
        setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la evaluación')
      } finally {
        setLoading(false)
      }
    },
    [apiFetch],
  )

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const history = await apiFetch<EvaluationRun[]>(
        `/assistants/${assistantId}/evaluations?limit=50`,
      )
      setRuns(history)
      if (!history.length) {
        setRun(null)
        setSelectedRunId('')
        setError('Este asistente todavía no tiene evaluaciones.')
        setLoading(false)
        return
      }
      const latestCompleted = history.find((item) => item.status === 'COMPLETED') || history[0]
      await loadRun(latestCompleted.id)
    } catch (requestError) {
      setRun(null)
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el historial')
      setLoading(false)
    }
  }, [apiFetch, assistantId, loadRun])

  useEffect(() => {
    void loadRuns()
  }, []) // Load the known local clone once; connection changes use the reload button.

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
          <p className="eyebrow">ULIBOT · EVALUACIÓN LOCAL</p>
          <h1>Resultados del asistente GLPI</h1>
          <p className="subtitle">
            Resumen ejecutivo y respuestas reales, caso por caso.
          </p>
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
            ID del asistente clonado
            <input
              type="number"
              min="1"
              value={assistantId}
              onChange={(event) => setAssistantId(Number(event.target.value))}
            />
          </label>
          <button onClick={() => void loadRuns()}>Cargar evaluaciones</button>
          <p>Esta pantalla consulta únicamente tu backend local.</p>
        </section>
      )}

      {error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>No se pudieron cargar los resultados.</strong>
            <span>{error}</span>
          </div>
          <button onClick={() => void loadRuns()}>Reintentar</button>
        </section>
      )}

      {loading && !run && <div className="loading-state">Cargando evaluación local…</div>}

      {run && (
        <>
          <section className="run-toolbar">
            <label>
              Evaluación
              <select value={selectedRunId} onChange={(event) => void loadRun(event.target.value)}>
                {runs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDate(item.createdAt)} · {item.status}
                  </option>
                ))}
              </select>
            </label>
            <div className="run-meta">
              <span>Modelo <strong>{run.modelSnapshot || '—'}</strong></span>
              <span>Juez <strong>{run.judgeModel}</strong></span>
              <span>Finalizada <strong>{formatDate(run.completedAt)}</strong></span>
            </div>
          </section>

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

          <nav className="evaluation-split" aria-label="Secciones de la evaluación">
            <a href="#model-evaluation">
              <span className="split-number">01</span>
              <span>
                <strong>Evaluación del modelo</strong>
                <small>Rendimiento, calidad, latencia y límites de la medición.</small>
              </span>
            </a>
            <a href="#prompt-evaluation">
              <span className="split-number">02</span>
              <span>
                <strong>Evaluación del prompt</strong>
                <small>Prompt exacto, fallos accionables y evidencia para corregirlo.</small>
              </span>
            </a>
          </nav>

          {summary && (
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

          <footer>
            <span>Run ID: {run.id}</span>
            <span>Datos obtenidos del backend local</span>
          </footer>
        </>
      )}
    </main>
  )
}

export default EvaluationViewer
