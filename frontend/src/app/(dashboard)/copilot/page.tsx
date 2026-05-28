"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/toast";
import { useCompanyId } from "@/lib/contexts/company-context";
import {
  Bot,
  Send,
  User,
  BookOpen,
  Loader2,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  is_fallback?: boolean;
}

function renderMarkdown(text: string) {
  // Split into lines for list handling
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) elements.push(<br key={`br-${lineIdx}`} />);

    // Process inline markdown: **bold** and *italic*
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    const rendered = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });

    elements.push(<span key={`line-${lineIdx}`}>{rendered}</span>);
  });

  return <>{elements}</>;
}

export default function CopilotPage() {
  const { toast } = useToast();
  const companyId = useCompanyId();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setSuggestions([]);

    try {
      const chatHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post<{
        answer: string;
        sources: string[];
        is_fallback: boolean;
        suggestions: string[];
      }>("/ai/copilot/ask", {
        question,
        company_id: companyId,
        chat_history: chatHistory,
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        is_fallback: res.is_fallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setSuggestions(res.suggestions || []);
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Erro ao enviar pergunta.");
      // Remover mensagem do usuário se falhou
      setMessages((prev) => prev.slice(0, -1));
      setInput(question);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "Quais dimensões estão em risco na minha empresa?",
    "Qual setor tem os piores scores?",
    "Como estão os planos de ação do PGR?",
    "O que muda com a Portaria MTE 1.419/2024?",
  ];

  return (
    <div className="max-w-[800px] mx-auto flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      {/* Header */}
      <div className="page-header mb-4">
        <h1 className="page-title text-heading-2 text-brand-text flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          Copiloto NR-01
        </h1>
        <p className="text-body-sm text-brand-muted mt-1">
          Tire dúvidas sobre a NR-01, riscos psicossociais e os dados da sua empresa.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-brand-border bg-white p-4 mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-primary/30 mx-auto mb-4" />
            <h2 className="text-heading-3 text-brand-text mb-2">Como posso ajudar?</h2>
            <p className="text-body-sm text-brand-muted mb-6">
              Pergunte sobre a NR-01, riscos psicossociais, COPSOQ II-Br ou sobre os dados da sua empresa.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs px-3 py-2 rounded-full border border-brand-border text-brand-text hover:bg-brand-bg-subtle transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-brand-bg-subtle text-brand-text rounded-bl-md"
              }`}
            >
              <div className="text-body-sm whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-black/10">
                  <div className="flex items-center gap-1 text-xs opacity-70">
                    <BookOpen className="w-3 h-3" />
                    Fontes: {msg.sources.join(", ")}
                  </div>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-brand-bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-brand-text" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-brand-bg-subtle rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 text-brand-muted animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion bubbles */}
      {suggestions.length > 0 && !sending && (
        <div className="flex flex-wrap gap-2 mb-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setInput(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          className="input-emotioncare flex-1 resize-none"
          rows={1}
          placeholder="Digite sua pergunta sobre a NR-01..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="btn btn-primary btn-md px-4"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
