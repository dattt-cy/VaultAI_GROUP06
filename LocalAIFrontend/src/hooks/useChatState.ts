import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../utils/apiClient';

export interface Citation {
  id: string;
  sourceFile: string;
  page: number;
  chunk_index: number;
  excerpt: string;
  relevant_spans?: string[];
  source_lines?: string[];
}

export interface TableData {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface Message {
  id: string;
  backendId?: number;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  isStreaming?: boolean;
  feedback?: 'like' | 'dislike' | 'report' | null;
  suggestions?: string[];
  isCancelled?: boolean;
  thinkingSteps?: string[];
  reasoningContent?: string;
  reasoningTime?: number;
  isReasoning?: boolean;
  tableData?: TableData;
}

export interface ChatSession {
  id: number;
  title: string;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi là Trợ lý AI nội bộ. Tôi có thể giúp bạn tra cứu, tóm tắt và phân tích các tài liệu nội bộ. Hãy chọn tài liệu và đặt câu hỏi để bắt đầu.',
  citations: [],
  suggestions: [],
  timestamp: new Date(),
};

export function useChatState() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cancelledQuestion, setCancelledQuestion] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load session list from API
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/sessions`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(
        (data.sessions ?? []).map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: new Date(s.updated_at),
          messageCount: s.message_count,
          lastMessage: s.last_message,
        }))
      );
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load messages of an existing session
  const loadSession = useCallback(async (sessionId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}/messages`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: Message[] = (data.messages ?? []).map((m: any) => ({
        id: String(m.id),
        backendId: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        citations: (m.citations ?? []).map((c: any, index: number) => ({
          id: `c-${c.document_id}-${c.chunk_index}-${index}`,
          sourceFile: c.sourceFile,
          page: c.chunk_index + 1,
          chunk_index: c.chunk_index,
          excerpt: c.content_preview,
          relevant_spans: c.relevant_spans || [],
          source_lines: c.source_lines || [],
        })),
        timestamp: new Date(m.created_at),
        feedback: m.feedback ?? null,
        suggestions: m.suggestions ?? [],
      }));
      setMessages(msgs.length > 0 ? msgs : [WELCOME_MSG]);
      setCurrentSessionId(sessionId);
    } catch { /* ignore */ }
  }, []);

  const newSession = useCallback(() => {
    setMessages([WELCOME_MSG]);
    setCurrentSessionId(null);
    setCancelledQuestion('');
  }, []);

  const cancelMessage = useCallback(() => {
    setMessages(prev => {
      const lastUser = [...prev].reverse().find(m => m.role === 'user');
      if (lastUser) setCancelledQuestion(lastUser.content);
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isStreaming));
      return [
        ...filtered,
        {
          id: `cancelled-${Date.now()}`,
          role: 'assistant' as const,
          content: '',
          citations: [],
          suggestions: [],
          timestamp: new Date(),
          isStreaming: false,
          isCancelled: true,
        },
      ];
    });
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    selectedDocIds: number[] = [],
    opts?: { skipUserAppend?: boolean }
  ) => {
    setCancelledQuestion('');

    if (!opts?.skipUserAppend) {
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
    }
    setIsGenerating(true);

    const assistantId = `a-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      citations: [],
      thinkingSteps: [],
      timestamp: new Date(),
      isStreaming: true,
    }]);

    abortControllerRef.current = new AbortController();
    let reasoningStartTime = 0;

    try {
      const response = await fetch(`${API_BASE}/api/chat/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content,
          session_id: currentSessionId,
          selected_doc_ids: selectedDocIds,
        }),
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'reasoning_start') {
              reasoningStartTime = Date.now();
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, isReasoning: true, reasoningContent: '' } : m
              ));
            } else if (data.type === 'reasoning') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, reasoningContent: (m.reasoningContent ?? '') + data.content }
                  : m
              ));
            } else if (data.type === 'reasoning_done') {
              const elapsed = reasoningStartTime ? (Date.now() - reasoningStartTime) / 1000 : 0;
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, isReasoning: false, reasoningTime: parseFloat(elapsed.toFixed(1)) }
                  : m
              ));
            } else if (data.type === 'thinking') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, thinkingSteps: [...(m.thinkingSteps ?? []), data.step] }
                  : m
              ));
            } else if (data.type === 'token') {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                let newContent = m.content + data.content;
                // Strip "(Điều X [A])", "(Điều 15, Tài liệu A)" ngay khi stream
                if (data.content.includes(')')) {
                  newContent = newContent.replace(
                    /\s*\(\s*(?:Điều|Khoản|Mục|Chương|Phần)\s+[\d.]+[^)]*\)/gi, ''
                  );
                }
                // Strip "[A, PHẦN X – ...]" markers ngay khi stream
                if (data.content.includes(']')) {
                  newContent = newContent.replace(
                    /\s*\[[A-Z],\s*(?:PHẦN|Phần|CHƯƠNG|Chương|MỤC|Mục|THƯỞNG|[^[\]]{1,30})\s*[–\-—][^\]]*\]/g, ''
                  );
                }
                // Ẩn block "Trích dẫn từ tài liệu:" khi đang stream để tránh bị "mất" sau corrected_text
                const citationBlockIdx = newContent.search(
                  /\n{1,2}[-•*]?\s*(?:Trích dẫn từ tài liệu|Nguồn trích dẫn)\s*[:.]/i
                );
                if (citationBlockIdx !== -1) {
                  newContent = newContent.slice(0, citationBlockIdx).trimEnd();
                }
                // Fix "câu.- Bullet" → "câu.\n- Bullet" khi stream (giống _clean_response backend)
                newContent = newContent.replace(
                  /([.!?])\s*(?=-\s*[A-ZĐÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂẮẶẦẤẨẪẮẶ])/g, '$1\n'
                );
                return { ...m, content: newContent };
              }));
            } else if (data.type === 'suggestions') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, suggestions: data.suggestions || [] } : m
              ));
            } else if (data.type === 'table') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, tableData: data.table_data } : m
              ));
            } else if (data.type === 'corrected_text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: data.content } : m
              ));
            } else if (data.type === 'relevant_spans') {
              const spans: string[][] = data.spans || [];
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m;
                const updated = (m.citations ?? []).map((c, i) => ({
                  ...c,
                  relevant_spans: spans[i] || [],
                }));
                return { ...m, citations: updated };
              }));
            } else if (data.type === 'done') {
              const citations: Citation[] = (data.citations || []).map((c: any, index: number) => ({
                id: `c-${c.document_id}-${c.chunk_index}-${index}`,
                sourceFile: c.sourceFile || `Tài liệu ${c.document_id}`,
                page: c.chunk_index + 1,
                chunk_index: c.chunk_index ?? index,
                excerpt: c.content_preview,
                relevant_spans: c.relevant_spans || [],
                source_lines: c.source_lines || [],
              }));
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, citations, isStreaming: false, backendId: data.message_id }
                  : m
              ));
              // Update session tracking + auto-name if first exchange
              if (data.session_id) {
                const sid = data.session_id;
                setCurrentSessionId(sid);
                // Auto-name: only on the first user message (currentSessionId was null before)
                if (!currentSessionId) {
                  const words = content.trim().split(/\s+/).slice(0, 8).join(' ');
                  const autoTitle = words.length < content.trim().length ? words + '...' : words;
                  fetch(`${API_BASE}/api/chat/sessions/${sid}`, {
                    method: 'PATCH', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: autoTitle }),
                  }).catch(() => { /* ignore */ });
                }
                loadSessions();
              }
              setIsGenerating(false);
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Lỗi kết nối đến Backend Local AI ở cổng 8000. Bạn đã chạy API chưa?', isStreaming: false }
          : m
      ));
      setIsGenerating(false);
    }
  }, [currentSessionId, loadSessions]);

  const setFeedback = useCallback((msgId: string, reaction: 'like' | 'dislike', comment?: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === msgId);
      const newReaction = msg?.feedback === reaction ? null : reaction;
      if (msg?.backendId && newReaction) {
        fetch(`${API_BASE}/api/chat/messages/${msg.backendId}/feedback?reaction=${newReaction.toUpperCase()}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_comment: comment ?? null }),
        }).catch(() => { /* ignore */ });
      }
      return prev.map(m => m.id === msgId ? { ...m, feedback: newReaction } : m);
    });
  }, []);

  const reportMessage = useCallback((msgId: string, reportType: string, comment: string) => {
    setMessages(prev => {
      const msg = prev.find(m => m.id === msgId);
      if (msg?.backendId) {
        const userComment = comment ? `[${reportType}] ${comment}` : `[${reportType}]`;
        fetch(`${API_BASE}/api/chat/messages/${msg.backendId}/feedback?reaction=HALLUCINATED`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_comment: userComment }),
        }).catch(() => { /* ignore */ });
      }
      return prev.map(m => m.id === msgId ? { ...m, feedback: 'report' } : m);
    });
  }, []);

  // Regenerate last assistant reply using the last user message as prompt
  const regenerateLast = useCallback(async (selectedDocIds: number[] = []) => {
    let lastUserContent = '';
    setMessages(prev => {
      let lastUserIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'user') { lastUserIdx = i; lastUserContent = prev[i].content; break; }
      }
      if (lastUserIdx < 0) return prev;
      return prev.slice(0, lastUserIdx + 1);
    });
    if (!lastUserContent) return;
    await sendMessage(lastUserContent, selectedDocIds, { skipUserAppend: true });
  }, [sendMessage]);

  // Edit a user message and re-send: truncate history up to (excluding) that message, then send normally
  const editAndResend = useCallback(async (messageId: string, newContent: string, selectedDocIds: number[] = []) => {
    let canResend = false;
    let truncateAfterBackendId: number | undefined;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx < 0) return prev;
      canResend = true;
      // Tìm message cuối cùng trước điểm edit có backendId để làm mốc truncate DB
      const prevMessages = prev.slice(0, idx);
      const lastWithId = [...prevMessages].reverse().find(m => m.backendId);
      truncateAfterBackendId = lastWithId?.backendId;
      return prevMessages;
    });
    if (!canResend) return;
    // Dọn DB: xóa tất cả messages sau mốc, tránh duplicate khi reload session
    if (currentSessionId && truncateAfterBackendId) {
      await fetch(
        `${API_BASE}/api/chat/sessions/${currentSessionId}/messages/truncate?after_message_id=${truncateAfterBackendId}`,
        { method: 'DELETE', credentials: 'include' }
      ).catch(() => { /* ignore — resend vẫn tiếp tục dù truncate lỗi */ });
    }
    await sendMessage(newContent, selectedDocIds);
  }, [sendMessage, currentSessionId]);

  const deleteSession = useCallback(async (sessionId: number) => {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (currentSessionId === sessionId) newSession();
    loadSessions();
  }, [currentSessionId, newSession, loadSessions]);

  const sessionTitle = sessions.find(s => s.id === currentSessionId)?.title ?? null;

  const renameSession = useCallback(async (sessionId: number, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: trimmed } : s));
    try {
      await fetch(`${API_BASE}/api/chat/sessions/${sessionId}?title=${encodeURIComponent(trimmed)}`, {
        method: 'PATCH', credentials: 'include',
      });
    } catch { /* ignore */ }
  }, []);

  return {
    messages, sessions, currentSessionId, sessionTitle, isGenerating, cancelledQuestion,
    sendMessage, cancelMessage, setFeedback, reportMessage, newSession, loadSession, deleteSession, loadSessions,
    renameSession, regenerateLast, editAndResend,
  };
}
