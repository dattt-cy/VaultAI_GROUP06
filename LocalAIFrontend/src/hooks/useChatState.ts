import { useState, useCallback } from 'react';

export interface Citation {
  id: string;
  sourceFile: string;
  page: number;
  excerpt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  isStreaming?: boolean;
  feedback?: 'like' | 'dislike' | null;
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
      content: 'Xin chào! Tôi là Trợ lý AI nội bộ. Tôi có thể giúp bạn tra cứu, tóm tắt và phân tích các tài liệu nội bộ. Hãy đặt câu hỏi hoặc chọn một câu hỏi mẫu bên trái để bắt đầu.',
      citations: [],
      timestamp: new Date(),
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsGenerating(true);

    // Simulate streaming AI response
    const assistantId = `a-${Date.now()}`;
    const fullResponse = `Dựa trên các tài liệu nội bộ được cung cấp, tôi tìm thấy thông tin liên quan đến câu hỏi của bạn. Theo **Điều 12, Khoản 3** của Quy chế nội bộ năm 2024, quy định này được áp dụng cho toàn bộ nhân viên thuộc biên chế chính thức. Ngoài ra, hệ thống cũng đã xác thực thông tin từ hợp đồng lao động mẫu hiện hành.`;

    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      citations: SAMPLE_CITATIONS,
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // Stream text character by character
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: fullResponse.slice(0, i), isStreaming: i < fullResponse.length }
          : m
      ));
      if (i >= fullResponse.length) {
        clearInterval(interval);
        setIsGenerating(false);
      }
    }, 30);
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
