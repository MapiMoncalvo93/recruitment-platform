import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('jds')
    .select('*, candidates(*)')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const { title, content } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('jds')
    .insert({ title, content })
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function PUT(req: NextRequest) {
  const { id, title, content } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('jds')
    .update({ title, content })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  const { error } = await supabaseAdmin
    .from('jds')
    .delete()
    .eq('id', id)

  if (error) return Response.json({ error }, { status: 500 })
  return Response.json({ success: true })
}