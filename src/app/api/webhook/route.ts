import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-sonnet-4-5';

const MAYA_SYSTEM_PROMPT = `You are Maya, the 24/7 AI guest communication agent for The Empire Stays — a premium short-term rental portfolio in Mumbai and Thane, India. Be warm, professional, concise. Never guarantee refunds or availability without verification. Escalate damage claims, safety emergencies, legal threats to the human host team immediately.`;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return NextResponse.json({ status: 'ok' });

    const message = messages[0];
    const from = message.from as string;
    const messageId = message.id as string;
    const timestamp = message.timestamp as string;

    await markMessageRead(messageId);

    if (message.type !== 'text') {
      await sendWhatsAppMessage(from, "Hi! Please type your question and I will help you right away!");
      return NextResponse.json({ status: 'ok' });
    }

    const text = message.text?.body as string;
    if (!text?.trim()) return NextResponse.json({ status: 'ok' });

    let { data: conversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('guest_phone', from)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          guest_phone: from,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      conversation = newConv;
    }

    const conversationId = conversation?.id;

    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: text,
        whatsapp_message_id: messageId,
        created_at: new Date(parseInt(timestamp) * 1000).toISOString(),
      });
    }

    const { data: history } = conversationId
      ? await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(12)
      : { data: [] };

    const aiMessages = [
      { role: 'system' as const, content: MAYA_SYSTEM_PROMPT },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let aiReply = "I'm having some trouble right now. Please contact our team directly. Thank you!";

    try {
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://whatsapp-maya-agent.vercel.app',
          'X-Title': 'Maya - The Empire Stays',
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: aiMessages,
          max_tokens: 400,
          temperature: 0.7,
        }),
      });
      const aiData = await aiRes.json();
      const c = aiData?.choices?.[0]?.message?.content;
      if (c?.trim()) aiReply = c.trim();
    } catch (e) {
      console.error('AI error:', e);
    }

    if (conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: aiReply,
        created_at: new Date().toISOString(),
      });
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    await sendWhatsAppMessage(from, aiReply);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  await fetch(
    `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    }
  );
}

async function markMessageRead(messageId: string): Promise<void> {
  await fetch(
    `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    }
  );
          }
