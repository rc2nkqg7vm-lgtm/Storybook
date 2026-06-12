import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Sparkles, BrainCircuit, X, MessageSquare, Loader2 } from "lucide-react";
import { Companion, ChatMessage, Storybook } from "../types";

const COMPANIONS: Companion[] = [
  {
    id: "silly_dragon",
    name: "Sparky",
    role: "Baby Dragon",
    avatar: "🦖",
    description: "Silly, happy, pancake eater helper!",
    color: "bg-natural-primary text-white",
    sound: "*puff flap snort!*"
  },
  {
    id: "wise_owl",
    name: "Barnaby",
    role: "Wise Owl",
    avatar: "🦉",
    description: "Gentle teacher owl of tricky words.",
    color: "bg-natural-accent text-white",
    sound: "*soft hoot hoot*"
  },
  {
    id: "magic_spark",
    name: "Pippin",
    role: "Speedy Star Pixie",
    avatar: "✨",
    description: "Flits around inside books. Lightning-fast responses!",
    color: "bg-natural-dark text-slate-100",
    sound: "*twinkle zip sparkle!*"
  }
];

interface CompanionChatProps {
  currentStory: Storybook | null;
}

export default function CompanionChat({ currentStory }: CompanionChatProps) {
  const [activeCompanion, setActiveCompanion] = useState<Companion>(COMPANIONS[0]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({
    silly_dragon: [
      { id: "init-1", role: "model", text: "HI! I'm Sparky! 🦖 Are we reading a story together? Type anything to talk! *flaps tail*" }
    ],
    wise_owl: [
      { id: "init-2", role: "model", text: "Hoot hoot! I am Barnaby. 🦉 I can explain any tricky word in your story books. What shall we learn about?" }
    ],
    magic_spark: [
      { id: "init-3", role: "model", text: "Twinkle zip! ✨ Pippin here! Ask me something super fast! Let's go!" }
    ]
  });

  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [askSuperBrain, setAskSuperBrain] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const currentChatHistory = messages[activeCompanion.id] || [];

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentChatHistory, loading, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userText = inputValue;
    setInputValue("");

    const userMessageId = Math.random().toString();
    const newUserMessage: ChatMessage = { id: userMessageId, role: "user", text: userText };

    // Append user message immediately
    setMessages((prev) => ({
      ...prev,
      [activeCompanion.id]: [...(prev[activeCompanion.id] || []), newUserMessage]
    }));

    setLoading(true);

    try {
      // Map state chat history to standard text history
      const restOfHistory = (messages[activeCompanion.id] || [])
        .filter(m => !m.id.startsWith("init")) // optional skip template welcome
        .map(m => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/story/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: restOfHistory,
          companionId: activeCompanion.id,
          userMessage: userText,
          currentStoryContext: currentStory ? { title: currentStory.title, pages: currentStory.pages } : null,
          askSuperBrain: askSuperBrain // Use gemini-3.1-pro-preview for complex tasks
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const modelMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "model",
        text: data.text
      };

      setMessages((prev) => ({
        ...prev,
        [activeCompanion.id]: [...(prev[activeCompanion.id] || []), modelMessage]
      }));
    } catch (err: any) {
      console.error(err);
      const errorMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "model",
        text: `*yawn* 💤 I got a bit sleepy smelling the meadow daisies! Speak up again, my friend: ${err.message}`
      };
      setMessages((prev) => ({
        ...prev,
        [activeCompanion.id]: [...(prev[activeCompanion.id] || []), errorMessage]
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button consistently designed in Natural Theme green */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-natural-primary hover:bg-natural-primary/95 text-white font-bold px-5 py-4 rounded-full shadow-2xl flex items-center gap-2 border-b-4 border-natural-muted transition-all cursor-pointer scale-100 active:scale-95"
      >
        <div className="relative">
          <MessageSquare size={20} />
          <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-natural-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-natural-accent"></span>
          </span>
        </div>
        <span className="text-xs sm:text-sm font-bold hidden sm:block">Talk to Story Helper</span>
      </button>

      {/* Slide-out Companion Chat Sidebar with cozy linen background */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 280, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 280, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-full sm:w-[380px] bg-natural-bg border-l border-natural-border shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
          >
            {/* Header: Select Buddy Role styled under Natural Tones template code */}
            <div className="bg-natural-primary text-white p-4 pb-5 flex flex-col gap-3 shadow relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={16} className="text-natural-soft" />
                  <h4 className="font-bold text-sm tracking-tight">Your Story Buddy Companion</h4>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Toggle Buttons to switch active companion */}
              <div className="grid grid-cols-3 gap-1.5">
                {COMPANIONS.map((companion) => (
                  <button
                    key={companion.id}
                    onClick={() => setActiveCompanion(companion)}
                    className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                      activeCompanion.id === companion.id
                        ? "bg-white text-natural-dark font-bold scale-105 shadow-sm"
                        : "bg-white/10 hover:bg-white/20 text-white font-medium text-xs"
                    }`}
                  >
                    <span className="text-xl leading-none">{companion.avatar}</span>
                    <span className="text-[10px] mt-0.5 leading-none">{companion.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Companion Header Meta Box in muted cream */}
            <div className="bg-natural-soft dark:bg-natural-bg border-b border-natural-border/60 p-3 flex items-center gap-3">
              <div className="p-1.5 rounded-2xl text-2xl bg-white dark:bg-natural-soft border border-natural-border/50">
                {activeCompanion.avatar}
              </div>
              <div>
                <h5 className="font-bold text-sm text-natural-dark flex items-center gap-1">
                  {activeCompanion.name} <span className="text-[10px] font-semibold text-natural-muted">({activeCompanion.role})</span>
                </h5>
                <p className="text-[11px] text-natural-muted font-medium leading-none mt-0.5 opacity-90">
                  {activeCompanion.description}
                </p>
              </div>
            </div>

            {/* Chat Thread */}
            <div
              ref={scrollRef}
              className="flex-1 p-4 overflow-y-auto space-y-4 scroll-smooth"
            >
              {currentStory && (
                <div className="p-2.5 bg-natural-soft border border-natural-border rounded-xl text-[10px] text-natural-dark font-bold flex items-center gap-1">
                  📖 Buddy loaded the storybook context: <span className="underline font-black">{currentStory.title}</span>!
                </div>
              )}

              {currentChatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                      msg.role === "user"
                        ? "bg-[#D48A6A] text-white rounded-br-none"
                        : "bg-white dark:bg-natural-clay/30 text-natural-dark border border-natural-border rounded-bl-none"
                    }`}
                  >
                    <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-natural-soft rounded-2xl p-3 border border-natural-border rounded-bl-none flex items-center gap-2">
                    <Loader2 className="animate-spin text-natural-primary" size={14} />
                    <span className="text-xs font-bold text-natural-primary animate-pulse">
                      {activeCompanion.name} is speaking...
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Input Area with natural design theme choices */}
            <div className="p-3 bg-white dark:bg-natural-bg border-t border-natural-border/50 space-y-3">
              {/* Complex reasoning selector */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={askSuperBrain}
                    onChange={(e) => setAskSuperBrain(e.target.checked)}
                    className="accent-natural-primary rounded focus:ring-0"
                  />
                  <span className="text-[10px] font-bold text-natural-muted flex items-center gap-1">
                    <BrainCircuit size={11} className="text-natural-primary" />
                    Deep wood wisdom explanation (Brain model)
                  </span>
                </label>
                {askSuperBrain && (
                  <span className="bg-natural-soft text-natural-primary text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase border border-natural-border/50">
                    gemini-3.1-pro
                  </span>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Ask ${activeCompanion.name} about characters or meanings...`}
                  className="flex-1 px-3.5 py-2.5 border border-natural-border/70 bg-white dark:bg-natural-soft rounded-xl focus:border-natural-primary focus:ring-0 focus:outline-none text-xs text-natural-dark font-medium"
                />
                <button
                  type="submit"
                  disabled={loading || !inputValue.trim()}
                  className="bg-natural-primary hover:bg-natural-primary/90 disabled:bg-natural-soft disabled:text-natural-muted text-white px-4.5 rounded-xl transition flex items-center justify-center shadow"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

