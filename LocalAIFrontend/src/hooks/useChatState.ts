import { useState, useCallback } from 'react';

export interface Citation {
  id: string;
  sourceFile: string;
  page: number;
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
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const SAMPLE_CITATIONS: Citation[] = [
  { id: 'c1', sourceFile: 'Quy chế nội bộ 2024.pdf', page: 5, excerpt: 'Điều 12. Quyền và nghĩa vụ của nhân viên...' },
  { id: 'c2', sourceFile: 'Hợp đồng lao động mẫu.docx', page: 2, excerpt: 'Điều khoản 3. Mức lương và phụ cấp...' },
];

const SAMPLE_SESSIONS: ChatSession[] = [
  {
    id: 's1',
    title: 'Tra cứu quy chế lương thưởng',
    createdAt: new Date(Date.now() - 86400000),
    messages: [],
  },
  {
    id: 's2',
    title: 'Hợp đồng dịch vụ với đối tác A',
    createdAt: new Date(Date.now() - 172800000),
    messages: [],
  },
  {
    id: 's3',
    title: 'So sánh quy định 2023 vs 2024',
    createdAt: new Date(Date.now() - 259200000),
    messages: [],
  },
];

export function useChatState() {
  const [sessions, setSessions] = useState<ChatSession[]>(SAMPLE_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>('current');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Xin chào! Tôi là Trợ lý AI nội bộ. Tôi có thể giúp bạn tra cứu, tóm tắt và phân tích các tài liệu nội bộ. Hãy chọn tài liệu và đặt câu hỏi để bắt đầu.',
      citations: [],
      suggestions: [],
      timestamp: new Date(),
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sendMessage = useCallback(async (content: string, selectedDocIds: number[] = []) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    const assistantId = `a-${Date.now()}`;
    
    // Thêm tin nhắn chờ phản hồi (Loading frame)
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '', // Empty content -> ChatMessage should render an animation
      citations: [],
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      // Gọi API thực tế xuống FastApi
      const response = await fetch('http://localhost:8000/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content, session_id: null, selected_doc_ids: selectedDocIds })
      });
      
      const data = await response.json();
      
      const formattedCitations: Citation[] = (data.citations || []).map((c: any, index: number) => ({
        id: `c-${c.document_id}-${c.chunk_index}-${index}`,
        sourceFile: c.sourceFile || `Tài liệu ${c.document_id}`,
        page: c.page_number || (c.chunk_index + 1),  // ★ Dùng page_number thật từ backend ★
        excerpt: c.content_preview,
        relevant_spans: c.relevant_spans || [],
      }));

      const suggestions: string[] = data.suggestions || [];
      const fullResponse = data.reply || "Dữ liệu trả về bị rỗng.";

      // Stream giả lập lại kết quả trả về để mượt mà trên UI
      let i = 0;
      const interval = setInterval(() => {
        i += 4;
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: fullResponse.slice(0, i), citations: formattedCitations, suggestions: i >= fullResponse.length ? suggestions : [], isStreaming: i < fullResponse.length }
            : m
        ));
        if (i >= fullResponse.length) {
          clearInterval(interval);
          setIsGenerating(false);
        }
      }, 30);

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Lỗi kết nối đến Backend Local AI ở cổng 8000. Bạn đã chạy API chưa?", isStreaming: false }
          : m
      ));
      setIsGenerating(false);
    }
  }, []);

  const setFeedback = useCallback((msgId: string, feedback: 'like' | 'dislike') => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
    ));
  }, []);

  const newSession = useCallback(() => {
    setMessages([]);
    setActiveSessionId('new-' + Date.now());
  }, []);

  return { messages, sessions, activeSessionId, isGenerating, sendMessage, setFeedback, newSession, setActiveSessionId };
}
