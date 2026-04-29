'use client'
import { useState, useEffect, useRef } from 'react'

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
  cv_text: string
  call_notes: string
  status: string
  analyses: Analysis[]
}

interface JD {
  id: string
  title: string
  content: string
  candidates: Candidate[]
}

export default function Home() {
  const [jds, setJDs] = useState<JD[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'dashboard'>('pipeline')
  const [analyzing, setAnalyzing] = useState<string | null>(null)

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
    setJDs(prev => [jd, ...prev])
  }

  async function updateJD(id: string, title: string, content: string) {
    await fetch('/api/jds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title, content })
    })
  }

  async function deleteJD(id: string) {
    await fetch('/api/jds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setJDs(prev => prev.filter(j => j.id !== id))
  }

  async function addCandidate(jdId: string) {
    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_id: jdId, name: 'New Candidate', cv_text: '' })
    })
    const candidate = await res.json()
    setJDs(prev => prev.map(j => j.id === jdId ? { ...j, candidates: [...(j.candidates || []), candidate] } : j))
  }

  async function updateCandidate(id: string, jdId: string, fields: Partial<Candidate>) {
    await fetch('/api/candidates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields })
    })
    setJDs(prev => prev.map(j => j.id === jdId ? {
      ...j,
      candidates: j.candidates.map(c => c.id === id ? { ...c, ...fields } : c)
    } : j))
  }

  async function uploadPDF(file: File, candidateId: string, jdId: string) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.text) {
      await updateCandidate(candidateId, jdId, { cv_text: data.text })
    }
  }

  async function analyzeCandidate(jd: JD, candidate: Candidate) {
    setAnalyzing(candidate.id)
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId: candidate.id,
        jdContent: jd.content,
        cvText: candidate.cv_text,
        callNotes: candidate.call_notes
      })
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.done) { fetchJDs(); setAnalyzing(null) }
        } catch {}
      }
    }
  }

  const totalCandidates = jds.reduce((a, j) => a + (j.candidates?.length || 0), 0)
  const highMatch = jds.reduce((a, j) => a + (j.candidates?.filter(c => c.analyses?.[0]?.score >= 80).length || 0), 0)
  const analyzed = jds.reduce((a, j) => a + (j.candidates?.filter(c => c.analyses?.length > 0).length || 0), 0)

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CV × JD Matcher</h1>
            <p className="text-gray-400 text-sm">Recruitment automation platform</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('pipeline')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'pipeline' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Pipeline</button>
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>Dashboard</button>
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold">{jds.length}</div><div className="text-gray-400 text-sm">Active roles</div></div>
              <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold">{totalCandidates}</div><div className="text-gray-400 text-sm">CVs screened</div></div>
              <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold text-green-600">{highMatch}</div><div className="text-gray-400 text-sm">≥80% match</div></div>
            </div>
            <div className="flex flex-col gap-4">
              {jds.map(jd => {
                const hi = jd.candidates?.filter(c => c.analyses?.[0]?.score >= 80).length || 0
                const total = jd.candidates?.length || 0
                return (
                  <div key={jd.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">{jd.title}</div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${hi >= 3 ? 'bg-green-100 text-green-700' : hi >= 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {hi >= 3 ? 'Strong pipeline' : hi >= 1 ? 'Building' : 'Needs sourcing'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">{hi} of {total} candidates ≥80% match</div>
                    <div className="mt-3 flex flex-col gap-2">
                      {(jd.candidates || []).filter(c => c.analyses?.[0]).sort((a, b) => (b.analyses[0]?.score || 0) - (a.analyses[0]?.score || 0)).map(c => (
                        <div key={c.id} className="flex items-center gap-3 text-sm">
                          <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">{(c.name || '?')[0]}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.analyses[0].score >= 80 ? 'bg-green-100 text-green-700' : c.analyses[0].score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{c.analyses[0].score}%</span>
                          <span className="text-xs text-gray-400">{c.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-400">{jds.length} role{jds.length !== 1 ? 's' : ''}</span>
              <button onClick={addJD} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add role</button>
            </div>
            <div className="flex flex-col gap-4">
              {jds.map(jd => (
                <div key={jd.id} className="bg-white rounded-xl border overflow-hidden">
                  <div className="bg-gray-50 p-4 flex items-center gap-3">
                    <input defaultValue={jd.title} onBlur={e => updateJD(jd.id, e.target.value, jd.content)} className="flex-1 bg-transparent font-semibold text-gray-800 outline-none" />
                    <span className="text-xs text-gray-400">{jd.candidates?.filter(c => c.analyses?.[0]?.score >= 80).length || 0}/{jd.candidates?.length || 0} ≥80%</span>
                    <button onClick={() => deleteJD(jd.id)} className="text-red-400 text-sm hover:text-red-600">Remove</button>
                  </div>
                  <div className="p-4">
                    <textarea defaultValue={jd.content} onBlur={e => updateJD(jd.id, jd.title, e.target.value)} placeholder="Paste job description here..." rows={4} className="w-full border rounded-lg p-3 text-sm text-gray-700 outline-none resize-none mb-4" />
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-400">{jd.candidates?.length || 0} candidates</span>
                      <button onClick={() => addCandidate(jd.id)} className="text-sm border px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-50">+ Add CV</button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {(jd.candidates || []).map(c => (
                        <CandidateRow
                          key={c.id}
                          candidate={c}
                          jd={jd}
                          analyzing={analyzing === c.id}
                          onAnalyze={() => analyzeCandidate(jd, c)}
                          onUploadPDF={(file) => uploadPDF(file, c.id, jd.id)}
                          onUpdateName={(name) => updateCandidate(c.id, jd.id, { name })}
                          onUpdateCV={(cv_text) => updateCandidate(c.id, jd.id, { cv_text })}
                          onUpdateStatus={(status) => updateCandidate(c.id, jd.id, { status })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function CandidateRow({ candidate: c, jd, analyzing, onAnalyze, onUploadPDF, onUpdateName, onUpdateCV, onUpdateStatus }: {
  candidate: Candidate
  jd: JD
  analyzing: boolean
  onAnalyze: () => void
  onUploadPDF: (file: File) => void
  onUpdateName: (name: string) => void
  onUpdateCV: (cv: string) => void
  onUpdateStatus: (status: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<'cv' | 'analysis' | 'report'>('cv')
  const fileRef = useRef<HTMLInputElement>(null)
  const analysis = c.analyses?.[0]

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{(c.name || '?')[0]}</span>
        <input value={c.name} onChange={e => onUpdateName(e.target.value)} onClick={e => e.stopPropagation()} className="flex-1 border-none outline-none text-sm font-medium bg-transparent" />
        {analysis && <span className={`text-xs px-2 py-1 rounded-full font-medium ${analysis.score >= 80 ? 'bg-green-100 text-green-700' : analysis.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{analysis.score}%</span>}
        <select value={c.status} onChange={e => { e.stopPropagation(); onUpdateStatus(e.target.value) }} onClick={e => e.stopPropagation()} className="text-xs border rounded px-2 py-1 text-gray-600 outline-none">
          <option value="screened">Screened</option>
          <option value="interviewed">Interviewed</option>
          <option value="submitted">Submitted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={e => { e.stopPropagation(); onAnalyze() }} disabled={!jd.content || !c.cv_text || analyzing} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-40">
          {analyzing ? 'Analyzing...' : analysis ? 'Re-analyze' : 'Analyze'}
        </button>
      </div>

      {expanded && (
        <div className="border-t p-3">
          <div className="flex gap-3 mb-3 border-b pb-2">
            {(['cv', 'analysis', 'report'] as const).map(s => (
              <button key={s} onClick={() => setActiveSection(s)} className={`text-xs px-3 py-1 rounded-full ${activeSection === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {s === 'cv' ? 'CV' : s === 'analysis' ? 'Analysis' : 'Report'}
              </button>
            ))}
          </div>

          {activeSection === 'cv' && (
            <div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => fileRef.current?.click()} className="text-xs border px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-50">
                  📎 Upload PDF
                </button>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) onUploadPDF(file)
                }} />
                <span className="text-xs text-gray-400 flex items-center">or paste below</span>
              </div>
              <textarea value={c.cv_text} onChange={e => onUpdateCV(e.target.value)} placeholder="Paste CV text here..." rows={6} className="w-full border rounded p-2 text-xs text-gray-600 outline-none resize-none" />
            </div>
          )}

          {activeSection === 'analysis' && analysis && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold">{analysis.score}%</span>
                <span className="text-sm text-gray-400">overall match</span>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Technical', value: analysis.technicalMatch },
                  { label: 'Experience', value: analysis.experienceMatch },
                  { label: 'Industry', value: analysis.industryMatch },
                  { label: 'Seniority', value: analysis.seniorityMatch },
                ].map(b => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-20">{b.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${b.value >= 80 ? 'bg-green-500' : b.value >= 60 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${b.value}%` }} />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{b.value}%</span>
                  </div>
                ))}
              </div>
              {analysis.strengths?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Strengths</div>
                  {analysis.strengths.map((s, i) => <div key={i} className="text-xs flex gap-2"><span className="text-green-500">✓</span>{s}</div>)}
                </div>
              )}
              {analysis.interviewQuestions?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Screening questions</div>
                  {analysis.interviewQuestions.map((q, i) => (
                    <div key={i} className="text-xs bg-gray-50 rounded p-2 mb-1"><span className="text-gray-400 mr-1">{i+1}.</span>{q}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'report' && analysis && (
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={() => navigator.clipboard?.writeText(analysis.report)} className="text-xs border px-3 py-1 rounded-lg text-gray-600">Copy report</button>
              </div>
              <div className="text-xs bg-gray-50 rounded p-3 whitespace-pre-wrap leading-relaxed">{analysis.report}</div>
            </div>
          )}

          {activeSection === 'analysis' && !analysis && (
            <div className="text-xs text-gray-400 text-center py-4">Run analysis first to see results.</div>
          )}
        </div>
      )}
    </div>
  )
}