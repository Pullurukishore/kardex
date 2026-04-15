"use client";

import { useState, useEffect, useRef } from "react";
import { apiService } from "@/services/api";
import {
  Send,
  Loader2,
  AlertTriangle,
  Brain,
  Bot,
  User,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Simple markdown renderer — handles **bold**, bullet points, emojis, and headings
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Headings
    if (line.startsWith("### ")) {
      return (
        <h4 key={i} className="font-bold text-[#546A7A] mt-3 mb-1 text-sm">
          {renderInline(line.slice(4))}
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={i} className="font-bold text-[#546A7A] mt-4 mb-1 text-base">
          {renderInline(line.slice(3))}
        </h3>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h2 key={i} className="font-bold text-[#546A7A] mt-4 mb-2 text-lg">
          {renderInline(line.slice(2))}
        </h2>
      );
    }
    // Bullet points
    if (line.match(/^[\s]*[-*•]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      return (
        <div
          key={i}
          className="flex items-start gap-1.5 my-0.5"
          style={{ paddingLeft: `${Math.min(indent * 4, 32)}px` }}
        >
          <span className="text-[#82A094] mt-1 text-xs">•</span>
          <span className="text-sm text-[#5D6E73] leading-relaxed">
            {renderInline(line.replace(/^[\s]*[-*•]\s/, ""))}
          </span>
        </div>
      );
    }
    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\./)?.[1];
      return (
        <div key={i} className="flex items-start gap-1.5 my-0.5">
          <span className="text-[#546A7A] font-bold text-xs mt-0.5 min-w-[16px]">
            {num}.
          </span>
          <span className="text-sm text-[#5D6E73] leading-relaxed">
            {renderInline(line.replace(/^\d+\.\s/, ""))}
          </span>
        </div>
      );
    }
    // Empty lines
    if (line.trim() === "") return <div key={i} className="h-2" />;
    // Horizontal rules
    if (line.match(/^[-_*]{3,}$/))
      return <hr key={i} className="my-2 border-[#AEBFC3]/30" />;
    // Regular text
    return (
      <p key={i} className="text-sm text-[#5D6E73] leading-relaxed my-0.5">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(text: string) {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#546A7A]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AITicketInsights() {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check AI status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await apiService.getTicketAIStatus();
        setAiConfigured(status.configured);
      } catch {
        setAiConfigured(false);
      }
    };
    checkStatus();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    // Add user message immediately
    const userMsg: ChatMessage = {
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const result = await apiService.ticketAIChat(msg);
      const botMsg: ChatMessage = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message || "AI is temporarily unavailable";
      const botMsg: ChatMessage = {
        role: "assistant",
        content: `⚠️ ${errMsg}`,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setChatLoading(false);
      // Re-focus input after sending
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = async () => {
    try {
      await apiService.clearTicketAIChat();
    } catch {
      /* ignore */
    }
    setChatMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyQuickQuestion = (question: string) => {
    setChatInput(question);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp: Date) =>
    timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Quick question buttons
  const quickQuestions = [
    {
      label: "🚑 Service Health",
      q: "Give me a summary of current service operations health",
    },
    {
      label: "⚠️ Priority Tickets",
      q: "Which high-priority tickets are still open and why?",
    },
    {
      label: "📍 Zone Performance",
      q: "Which zone has the slowest resolution time?",
    },
    {
      label: "📈 SLA Tracking",
      q: "How are we performing against our resolution SLAs?",
    },
    {
      label: "💡 Efficiency",
      q: "How can we improve ticket resolution efficiency this week?",
    },
  ];

  // Not configured state
  if (aiConfigured === false) {
    return (
      <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-r from-[#546A7A]/5 to-[#96AEC2]/5">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center shadow-lg mb-6">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#546A7A] mb-2">
              AI Ticket Intelligence Not Configured
            </h3>
            <p className="text-[#5D6E73] mb-6 leading-relaxed">
              To enable AI-powered ticket insights, please add your{" "}
              <code className="bg-[#AEBFC3]/20 px-1.5 py-0.5 rounded text-xs font-mono">
                GEMINI_API_KEY
              </code>{" "}
              to the{" "}
              <code className="bg-[#AEBFC3]/20 px-1.5 py-0.5 rounded text-xs font-mono">
                .env.local
              </code>{" "}
              file in your frontend directory.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#546A7A] font-medium underline hover:text-[#6F8A9D] transition-colors"
            >
              Get a free Gemini API key →
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (aiConfigured === null) return null;

  return (
    <Card className="w-full border-0 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
      {/* Decorative gradient top bar */}
      <div className="h-1 bg-gradient-to-r from-[#82A094] via-[#546A7A] to-[#CE9F6B] flex-shrink-0" />

      {/* Chat Header */}
      <div className="bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              AI Service Intelligence
              <span className="text-[10px] font-medium bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Powered by Gemini
              </span>
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              Your interactive service analyst.
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={clearChat}
            disabled={chatLoading || chatMessages.length === 0}
            className="text-white/80 hover:text-white hover:bg-white/10"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gradient-to-b from-[#AEBFC3]/5 to-white">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center w-full max-w-5xl mx-auto px-2">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#546A7A]/10 to-[#6F8A9D]/10 flex items-center justify-center mb-6 shadow-sm border border-white">
              <Bot className="h-10 w-10 text-[#546A7A]" />
            </div>
            <h2 className="text-2xl font-bold text-[#546A7A] mb-2">
              How can I help you analyze service tickets today?
            </h2>
            <p className="text-[#92A2A5] mb-8">
              I have access to open tickets, resolution times, SLA compliance, and zone statistics.
            </p>
            <div className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickQuestions.map((qq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyQuickQuestion(qq.q)}
                  className="w-full text-left text-sm px-4 py-2.5 rounded-xl border border-[#AEBFC3]/30 bg-white text-[#5D6E73] hover:bg-[#546A7A]/5 hover:border-[#546A7A]/30 hover:text-[#546A7A] transition-all shadow-sm"
                >
                  {qq.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <Bot className="h-5 w-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[90%] md:max-w-[82%] rounded-2xl px-4 md:px-5 py-3.5 md:py-4 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] text-white rounded-tr-sm shadow-md"
                  : "bg-white border border-[#AEBFC3]/20 shadow-md rounded-tl-sm"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-base">{msg.content}</p>
              ) : (
                <div className="space-y-1">{renderMarkdown(msg.content)}</div>
              )}
              <p
                className={`mt-2 text-[11px] ${msg.role === "user" ? "text-white/70" : "text-[#92A2A5]"}`}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
            {msg.role === "user" && (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#CE9F6B] to-[#976E44] flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                <User className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="flex gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#546A7A] to-[#6F8A9D] flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="bg-white border border-[#AEBFC3]/20 rounded-2xl rounded-tl-sm px-6 py-4 shadow-md flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#546A7A]" />
              <span className="text-sm font-medium text-[#92A2A5]">
                Analyzing service data...
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t border-[#AEBFC3]/20 p-4 bg-gray-50 flex-shrink-0">
        <div className="w-full flex gap-3 max-w-5xl mx-auto">
          <Input
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about service health, aging tickets, SLA performance..."
            disabled={chatLoading}
            className="flex-1 h-12 text-base border-[#AEBFC3]/30 focus:border-[#546A7A] focus:ring-[#546A7A]/20 rounded-xl shadow-sm bg-white"
          />
          <Button
            onClick={sendMessage}
            disabled={chatLoading || !chatInput.trim()}
            className="h-12 w-12 p-0 bg-gradient-to-r from-[#546A7A] to-[#6F8A9D] hover:from-[#4F6A64] hover:to-[#546A7A] rounded-xl shadow-md transition-all active:scale-95"
            title="Send message"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
