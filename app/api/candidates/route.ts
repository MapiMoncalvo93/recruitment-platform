import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const jdId = req.nextUrl.searchParams.get('jd_id')

  const query = supabaseAdmin
    .from('candidates')
    .select('*, analyses(*)')
    .order('created_at', { ascending: false })

  if (jdId) query.eq('jd_id', jdId)

  const { data, error } = await query
  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const { jd_id, name, cv_text } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .insert({ jd_id, name, cv_text })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function PUT(req: NextRequest) {
  const { id, name, cv_text, call_notes, status } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('candidates')
    .update({ name, cv_text, call_notes, status })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  const { error } = await supabaseAdmin
    .from('candidates')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ success: true })
}