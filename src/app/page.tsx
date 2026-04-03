'use client';

import { useEffect, useState, useCallback } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sent_by?: string;
}

interface Conversation {
  id: string;
  guest_phone: string;
  guest_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  const fetchConversations = useCallback(async () => {
    try {
      const url = filter === 'all' ? '/api/conversations' : `/api/conversations?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const selectConversation = async (conv: Conversation) => {
    setSelected(conv);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) { console.error(err); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (res.ok) {
        setReply('');
        const r = await fetch(`/api/conversations/${selected.id}/messages`);
        const d = await r.json();
        setMessages(d.messages || []);
      }
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchConversations();
  };

  const fmt = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
  };

  const s: Record<string, React.CSSProperties> = {
    root: { display: 'flex', height: '100vh', fontFamily: 'Inter,sans-serif', background: '#0d1117' },
    sidebar: { width: 320, background: '#161b22', color: '#fff', display: 'flex', flexDirection: 'column', borderRight: '1px solid #30363d' },
    sideHeader: { padding: '16px', borderBottom: '1px solid #30363d', background: '#161b22' },
    logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
    avatar: { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
    convList: { flex: 1, overflowY: 'auto' as const },
    main: { flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117' },
    emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#484f58' },
    chatHeader: { padding: '14px 20px', borderBottom: '1px solid #30363d', background: '#161b22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    msgArea: { flex: 1, overflowY: 'auto' as const, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
    inputRow: { padding: '14px 20px', borderTop: '1px solid #30363d', background: '#161b22', display: 'flex', gap: 10 },
  };

  return (
    <div style={s.root}>
      <div style={s.sidebar}>
        <div style={s.sideHeader}>
          <div style={s.logoRow}>
            <div style={s.avatar}>&#128120;</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Maya</div>
              <div style={{ fontSize: 11, color: '#8b949e' }}>The Empire Stays · WhatsApp Agent</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'active', 'closed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: filter === f ? '#388bfd' : '#21262d', color: filter === f ? '#fff' : '#8b949e', textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
        </div>
        <div style={s.convList}>
          {loading ? <div style={{ padding: 20, color: '#8b949e', textAlign: 'center' }}>Loading…</div>
            : conversations.length === 0 ? <div style={{ padding: 20, color: '#484f58', textAlign: 'center', fontSize: 13 }}>No conversations yet</div>
            : conversations.map(conv => (
              <div key={conv.id} onClick={() => selectConversation(conv)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #21262d', background: selected?.id === conv.id ? '#21262d' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{conv.guest_name || conv.guest_phone}</div>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: conv.status === 'active' ? '#1a4a2e' : '#21262d', color: conv.status === 'active' ? '#3fb950' : '#8b949e' }}>{conv.status}</span>
                </div>
                <div style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>{fmt(conv.last_message_at || conv.updated_at)}</div>
              </div>
            ))}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #30363d', fontSize: 11, color: '#484f58', display: 'flex', justifyContent: 'space-between' }}>
          <span>Total: {conversations.length}</span>
          <span>Active: {conversations.filter(c => c.status === 'active').length}</span>
          <span>Live ✓</span>
        </div>
      </div>
      <div style={s.main}>
        {!selected ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128120;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#6e7681' }}>Select a conversation</div>
            <div style={{ fontSize: 12, color: '#484f58', marginTop: 6 }}>Maya is active 24/7</div>
          </div>
        ) : (
          <>
            <div style={s.chatHeader}>
              <div>
                <div style={{ fontWeight: 700, color: '#e6edf3' }}>{selected.guest_name || selected.guest_phone}</div>
                <div style={{ fontSize: 12, color: '#8b949e' }}>{selected.guest_phone} · {fmt(selected.created_at)}</div>
              </div>
              <button onClick={() => updateStatus(selected.id, selected.status === 'active' ? 'closed' : 'active')} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: selected.status === 'active' ? '#3d1c1c' : '#1a4a2e', color: selected.status === 'active' ? '#f85149' : '#3fb950' }}>
                {selected.status === 'active' ? 'Close' : 'Reopen'}
              </button>
            </div>
            <div style={s.msgArea}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '65%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: msg.role === 'user' ? '#21262d' : msg.sent_by === 'human' ? '#2d1f47' : '#1c3a2a', color: '#e6edf3', fontSize: 13, lineHeight: 1.5 }}>
                    <div>{msg.content}</div>
                    <div style={{ fontSize: 10, color: '#484f58', marginTop: 4, textAlign: 'right' }}>
                      {msg.role === 'assistant' && (msg.sent_by === 'human' ? '👤 Host' : '👸 Maya')} {fmt(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={s.inputRow}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }} placeholder="Reply as host… (Enter to send)" rows={2} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #30363d', background: '#0d1117', color: '#e6edf3', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={sendReply} disabled={sending || !reply.trim()} style={{ padding: '0 18px', borderRadius: 8, border: 'none', background: !reply.trim() || sending ? '#21262d' : 'linear-gradient(135deg,#388bfd,#6e40c9)', color: '#fff', cursor: !reply.trim() || sending ? 'not-allowed' : 'pointer', fontWeight: 700, minWidth: 70 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
  }
