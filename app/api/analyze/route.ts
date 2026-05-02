import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { candidateId, jdContent, cvText, callNotes } = await req.json()

    const systemPrompt = `You are an expert technical recruiter. 
Analyze CVs against Job Descriptions and return ONLY a valid JSON object.
No markdown, no explanation — pure JSON.`

    const userMessage = `JOB DESCRIPTION:\n${jdContent}\n\nCV:\n${cvText}${
      callNotes ? `\n\nSCREENING CALL NOTES:\n${callNotes}` : ''
    }

Return this exact JSON structure:
{
  "score": <0-100>,
  "technicalMatch": <0-100>,
  "experienceMatch": <0-100>,
  "industryMatch": <0-100>,
  "seniorityMatch": <0-100>,
  "summary": "<2-3 sentences>",
  "strengths": ["...", "...", "..."],
  "gaps": {
    "technical": ["..."],
    "industry": ["..."],
    "tools": ["..."],
    "seniority": ["..."]
  },
  "interviewQuestions": ["...", "...", "...", "..."],
  "report": "<full formatted candidate report>"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)

    await supabaseAdmin.from('analyses').insert({
      candidate_id: candidateId,
      score: parsed.score,
      technical_match: parsed.technicalMatch,
      experience_match: parsed.experienceMatch,
      industry_match: parsed.industryMatch,
      seniority_match: parsed.seniorityMatch,
      strengths: parsed.strengths,
      gaps: parsed.gaps,
      interview_questions: parsed.interviewQuestions,
      summary: parsed.summary,
      report: parsed.report,
    })

    return Response.json({ result: parsed })
  } catch (err) {
    console.error('Analyze error:', err)
    return Response.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}