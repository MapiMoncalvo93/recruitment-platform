'use client'
import { useState, useEffect } from 'react'

interface Analysis {
  score: number
  technicalMatch: number
  experienceMatch: number
  industryMatch: number
  seniorityMatch: number
  summary: string
  strengths: string[]
  gaps: { technical: string[], industry: string[], tools: string[], seniority: string[] }
  interviewQuestions: string[]
  report: string
}

interface Candidate {
  id: string
  name: string
  cv_text: string | null
  call_notes: string | null
  status: string
  analyses: Analysis[]
  uploading?: boolean
}

interface JD {
  id: string
  title: string
  content: string | null
  candidates: Candidate[]
  collapsed?: boolean
}

export default function Home() {
  const [jds, setJDs] = useState<JD[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set())

  useEffect(() => { fetchJDs() }, [])

  async function fetchJDs() {
    const res = await fetch('/api/jds')
    const data = await res.json()
    setJDs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function addJD() {
    const res = await fetch('/api/jds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Role', content: '' })
    })
    const jd = await res.json()
    setJDs(prev => [{ ...jd, candidates: [], collapsed: false }, ...prev])
  }

  async function updateJD(id: string, field: 'title' | 'content', value: string) {
    setJDs(prev => prev.map(j => j.id === id ? { ...j, [field]: value } : j))
    await fetch('/api/jds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value })
    })
  }

  async function deleteJD(id: string) {
    if (!confirm('Delete this role and all its candidates?')) return
    await fetch('/api/jds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setJDs(prev => prev.filter(j => j.id !== id))
  }

  function toggleCollapse(id: string) {
    setJDs(prev => prev.map(j => j.id === id ? { ...j, collapsed: !j.collapsed } : j))
  }

  async function addCandidate(jdId: string) {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_id: jdId, name: 'New Candidate', cv_text: '' })
    })
    const candidate = await res.json()
    setJDs(prev => prev.map(j =>
      j.id === jdId ? { ...j, candidates: [...(j.candidates || []), { ...candidate, analyses: [] }] } : j
    ))
  }

  async function updateCandidate(jdId: string, candidateId: string, field: string, value: string) {
    setJDs(prev => prev.map(j =>
      j.id === jdId ? {
        ...j, candidates: j.candidates.map(c =>
          c.id === candidateId ? { ...c, [field]: value } : c
        )
      } : j
    ))
    await fetch('/api/candidates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidateId, [field]: value })
    })
  }

  async function deleteCandidate(jdId: string, candidateId: string) {
    await fetch('/api/candidates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidateId })
    })
    setJDs(prev => prev.map(j =>
      j.id === jdId ? { ...j, candidates: j.candidates.filter(c => c.id !== candidateId) } : j
    ))
  }

  async function uploadPDF(jdId: string, candidateId: string, file: File) {
    setJDs(prev => prev.map(j =>
      j.id === jdId ? {
        ...j, candidates: j.candidates.map(c =>
          c.id === candidateId ? { ...c, uploading: true } : c
        )
      } : j
    ))
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.text) await updateCandidate(jdId, candidateId, 'cv_text', data.text)
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to parse PDF. Try pasting the CV text manually.')
    } finally {
      setJDs(prev => prev.map(j =>
        j.id === jdId ? {
          ...j, candidates: j.candidates.map(c =>
            c.id === candidateId ? { ...c, uploading: false } : c
          )
        } : j
      ))
    }
  }

  async function analyze(jdId: string, candidateId: string) {
    const jd = jds.find(j => j.id === jdId)
    const candidate = jd?.candidates.find(c => c.id === candidateId)
    if (!jd || !candidate) return

    setAnalyzing(prev => new Set(prev).add(candidateId))

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId,
          jdContent: jd.content,
          cvText: candidate.cv_text,
          callNotes: candidate.call_notes
        })
      })
      const data = await res.json()
      if (data.result) {
        setJDs(prev => prev.map(j =>
          j.id === jdId ? {
            ...j, candidates: j.candidates.map(c =>
              c.id === candidateId ? { ...c, analyses: [data.result, ...(c.analyses || [])] } : c
            )
          } : j
        ))
      }
    } finally {
      setAnalyzing(prev => {
        const next = new Set(prev)
        next.delete(candidateId)
        return next
      })
    }
  }

  const statusColors: Record<string, string> = {
    screened: 'bg-gray-100 text-gray-600',
    interviewing: 'bg-blue-100 text-blue-700',
    offer: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Recruitment Pipeline</h1>
          <p className="text-xs text-gray-400">{jds.length} active role{jds.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={addJD}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition"
        >
          + Add Role
        </button>
      </div>

      <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-65px)] items-start">
        {jds.length === 0 && (
          <div className="text-gray-400 text-sm m-auto">No roles yet. Click "+ Add Role" to start.</div>
        )}
        {jds.map(jd => (
          <div key={jd.id} className="flex-shrink-0 w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <input
                  className="font-semibold text-sm text-gray-900 bg-transparent border-none outline-none w-full"
                  value={jd.title ?? ''}
                  onChange={e => updateJD(jd.id, 'title', e.target.value)}
                  onBlur={e => updateJD(jd.id, 'title', e.target.value)}
                />
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => toggleCollapse(jd.id)} className="text-gray-400 hover:text-gray-600 text-xs px-1">
                    {jd.collapsed ? '▼' : '▲'}
                  </button>
                  <button onClick={() => deleteJD(jd.id)} className="text-gray-300 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              </div>
              <textarea
                className="w-full text-xs text-gray-500 border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:border-gray-300"
                rows={3}
                placeholder="Paste Job Description here..."
                value={jd.content ?? ''}
                onChange={e => updateJD(jd.id, 'content', e.target.value)}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{(jd.candidates || []).length} candidate{(jd.candidates || []).length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => addCandidate(jd.id)}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg text-gray-700 transition"
                >
                  + Add Candidate
                </button>
              </div>
            </div>

            {!jd.collapsed && (
              <div className="p-3 flex flex-col gap-3 overflow-y-auto max-h-[600px]">
                {(jd.candidates || []).map(c => {
                  const latestAnalysis = c.analyses?.[0]
                  const isAnalyzing = analyzing.has(c.id)
                  return (
                    <div key={c.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <input
                          className="text-xs font-medium text-gray-800 bg-transparent border-none outline-none w-full"
                          value={c.name ?? ''}
                          onChange={e => updateCandidate(jd.id, c.id, 'name', e.target.value)}
                          onBlur={e => updateCandidate(jd.id, c.id, 'name', e.target.value)}
                        />
                        <button onClick={() => deleteCandidate(jd.id, c.id)} className="text-gray-300 hover:text-red-400 text-xs ml-1">✕</button>
                      </div>

                      {latestAnalysis && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            latestAnalysis.score >= 80 ? 'bg-green-100 text-green-700' :
                            latestAnalysis.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-600'
                          }`}>{latestAnalysis.score}%</span>
                          <span className="text-xs text-gray-400 truncate">{latestAnalysis.summary?.slice(0, 50)}...</span>
                        </div>
                      )}

                      <select
                        value={c.status ?? 'screened'}
                        onChange={e => updateCandidate(jd.id, c.id, 'status', e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-none mb-2 ${statusColors[c.status] || statusColors.screened}`}
                      >
                        <option value="screened">Screened</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="offer">Offer</option>
                        <option value="rejected">Rejected</option>
                      </select>

                      <div className="flex gap-2 mb-2">
                        <label
                          className={`text-xs border px-2 py-1 rounded-lg cursor-pointer transition ${
                            c.uploading ? 'bg-blue-50 text-blue-500 border-blue-200' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          onClick={e => e.stopPropagation()}
                        >
                          {c.uploading ? '⏳ Parsing...' : '📎 Upload CV'}
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const file = e.target.files?.[0]
                              if (file) uploadPDF(jd.id, c.id, file)
                            }}
                          />
                        </label>
                        {c.cv_text && <span className="text-xs text-green-500 self-center">✓ CV loaded</span>}
                      </div>

                      <textarea
                        className="w-full text-xs border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:border-gray-300 mb-2"
                        rows={2}
                        placeholder="Or paste CV text..."
                        value={c.cv_text ?? ''}
                        onChange={e => updateCandidate(jd.id, c.id, 'cv_text', e.target.value)}
                      />

                      <textarea
                        className="w-full text-xs border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:border-gray-300 mb-2"
                        rows={2}
                        placeholder="Call notes (optional)..."
                        value={c.call_notes ?? ''}
                        onChange={e => updateCandidate(jd.id, c.id, 'call_notes', e.target.value)}
                      />

                      <button
                        onClick={() => analyze(jd.id, c.id)}
                        disabled={isAnalyzing || !c.cv_text || !jd.content}
                        className={`w-full text-xs py-1.5 rounded-lg transition font-medium ${
                          isAnalyzing ? 'bg-blue-100 text-blue-500 cursor-wait' :
                          (!c.cv_text || !jd.content) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                          'bg-gray-900 text-white hover:bg-gray-700'
                        }`}
                      >
                        {isAnalyzing ? '⏳ Analyzing...' : '↗ Analyze'}
                      </button>

                      {latestAnalysis && !isAnalyzing && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="text-xs text-gray-500 font-medium mb-1">Gaps:</div>
                          {Object.entries(latestAnalysis.gaps || {}).map(([k, v]) =>
                            (v as string[]).length > 0 ? (
                              <div key={k} className="text-xs text-red-500">• {(v as string[]).join(', ')}</div>
                            ) : null
                          )}
                          {latestAnalysis.strengths?.slice(0, 2).map((s, i) => (
                            <div key={i} className="text-xs text-green-600">✓ {s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}