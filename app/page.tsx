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

  async function analyzeCandidate(jd: JD, candidate: Candidate) {
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
          if (data.done) fetchJDs()
        } catch {}
      }
    }
  }

  const totalCandidates = jds.reduce((a, j) => a + (j.candidates?.length || 0), 0)
  const highMatch = jds.reduce((a, j) => a + (j.candidates?.filter(c => c.analyses?.[0]?.score >= 80).length || 0), 0)

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
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold">{jds.length}</div><div className="text-gray-400 text-sm">Active roles</div></div>
            <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold">{totalCandidates}</div><div className="text-gray-400 text-sm">CVs screened</div></div>
            <div className="bg-white rounded-xl border p-4 text-center"><div className="text-3xl font-bold text-green-600">{highMatch}</div><div className="text-gray-400 text-sm">≥80% match</div></div>
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
                        <div key={c.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">{(c.name || '?')[0]}</span>
                            <span className="font-medium text-sm">{c.name || 'Unnamed'}</span>
                            {c.analyses?.[0] && <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${c.analyses[0].score >= 80 ? 'bg-green-100 text-green-700' : c.analyses[0].score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{c.analyses[0].score}%</span>}
                            <button onClick={() => analyzeCandidate(jd, c)} disabled={!jd.content || !c.cv_text} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-40">Analyze</button>
                          </div>
                          <textarea defaultValue={c.cv_text} placeholder="Paste CV here..." rows={3} className="w-full border rounded p-2 text-xs text-gray-600 outline-none resize-none" />
                          {c.analyses?.[0] && (
                            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{c.analyses[0].summary}</div>
                          )}
                        </div>
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