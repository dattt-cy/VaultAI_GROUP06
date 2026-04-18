import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../utils/apiClient';

export interface Citation {
  id: string;
  sourceFile: string;
  page: number;
  chunk_index: number;
  excerpt: string;
  relevant_spans?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  isStreaming?: boolean;
  feedback?: 'like' | 'dislike' | null;
  suggestions?: string[];
  isCancelled?: boolean;
  thinkingSteps?: string[];
  reasoningContent?: string;
  reasoningTime?: number;
  isReasoning?: boolean;
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
        role: m.role as 'user' | 'assistant',
        content: m.content,
        citations: [],
        timestamp: new Date(m.created_at),
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

  const sendMessage = useCallback(async (content: string, selectedDocIds: number[] = []) => {
    setCancelledQuestion('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
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
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + data.content } : m
              ));
            } else if (data.type === 'suggestions') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, suggestions: data.suggestions || [] } : m
              ));
            } else if (data.type === 'corrected_text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: data.content } : m
              ));
            } else if (data.type === 'done') {
              const citations: Citation[] = (data.citations || []).map((c: any, index: number) => ({
                id: `c-${c.document_id}-${c.chunk_index}-${index}`,
                sourceFile: c.sourceFile || `Tài liệu ${c.document_id}`,
                page: c.chunk_index + 1,
                chunk_index: c.chunk_index ?? index,
                excerpt: c.content_preview,
                relevant_spans: c.relevant_spans || [],
              }));
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, citations, suggestions: data.suggestions || [], isStreaming: false }
                  : m
              ));
              // Update session tracking
              if (data.session_id) {
                setCurrentSessionId(data.session_id);
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

  const setFeedback = useCallback((msgId: string, feedback: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
    ));
  }, []);

  const deleteSession = useCallback(async (sessionId: number) => {
    await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (currentSessionId === sessionId) newSession();
    loadSessions();
  }, [currentSessionId, newSession, loadSessions]);

  return {
    messages, sessions, currentSessionId, isGenerating, cancelledQuestion,
    sendMessage, cancelMessage, setFeedback, newSession, loadSession, deleteSession, loadSessions,
  };
}
