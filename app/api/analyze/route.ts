import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const { candidateId, jdContent, cvText, callNotes } = await req.json()

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

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

  ;(async () => {
    let fullText = ''
    const anthropicStream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    for await (const chunk of anthropicStream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text
        await writer.write(encoder.encode(`data: ${JSON.stringify({ partial: fullText })}\n\n`))
      }
    }

    try {
      const parsed = JSON.parse(fullText)
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
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, result: parsed })}\n\n`))
    } catch {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: 'Parse failed' })}\n\n`))
    }
    await writer.close()
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}