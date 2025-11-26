import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Content, Part } from "@google/genai";
import { Deal } from '../types';

interface SalesCoachProps {
  deals: Deal[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const SalesCoach: React.FC<SalesCoachProps> = ({ deals }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('prism_sales_coach_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    } else {
      setMessages([
        { 
          role: 'model', 
          text: "Hi! I'm your automated Sales Coach. I've analyzed your pipeline. How can I help you close more deals today?" 
        }
      ]);
    }
  }, []);

  // Save to local storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('prism_sales_coach_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      // 1. Initialize API
      // Note: In a real production app, you might proxy this through your backend 
      // to keep the key secure, or use a specific frontend-restricted key.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // 2. Prepare Context
      // We explicitly strictly type the deals to JSON string for the prompt
      const dealsContext = JSON.stringify(deals.map(d => ({
        id: d.id,
        title: d.title,
        company: d.companyName,
        stage: d.stage,
        value: d.expectedValue,
        prob: d.closeProbability,
        nextStep: d.nextAction,
        lastContact: d.lastContactDate,
        notes: d.notes
      })), null, 2);

      const systemInstruction = `
        You are an elite Sales Coach. You are sharp, strategic, aggressive but helpful, and focused purely on revenue and deal velocity.
        
        You have access to the user's current CRM pipeline data below. 
        ALWAYS reference specific deals from this data when answering, if relevant.
        
        Your goals:
        1. Identify stalled deals (old last contact date).
        2. Suggest specific, tactical next steps (e.g., "Send an email to Alice at Acme asking about X").
        3. Roleplay negotiation or objection handling if asked.
        4. Be concise. Do not write long paragraphs. Use bullet points.
        
        CURRENT PIPELINE DATA:
        ${dealsContext}
      `;

      // 3. Prepare History for the API
      // Transform our simple Message format to the API's Content format
      const history: Content[] = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text } as Part]
      }));

      // 4. Create Chat
      const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemInstruction,
        },
        history: history
      });

      // 5. Send Message
      const result = await chat.sendMessage({ message: userMsg.text });
      const responseText = result.text;

      setMessages(prev => [...prev, { role: 'model', text: responseText }]);

    } catch (error) {
      console.error("Gemini API Error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: "I'm having trouble connecting to my brain right now. Please check your internet connection or API key." 
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    if(confirm("Are you sure you want to clear the chat history?")) {
      setMessages([{ role: 'model', text: "Chat cleared. What's next?" }]);
      localStorage.removeItem('prism_sales_coach_history');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Header */}
      <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500 rounded-lg">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          </div>
          <div>
            <h2 className="font-bold text-lg">Sales Coach AI</h2>
            <p className="text-indigo-200 text-xs">Powered by Gemini 2.5 • Context-Aware</p>
          </div>
        </div>
        <button 
          onClick={clearHistory}
          className="text-indigo-200 hover:text-white text-sm hover:underline"
        >
          Clear Memory
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none prose prose-sm'
              }`}
            >
              {/* Simple Markdown-like rendering for line breaks */}
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
              ))}
            </div>
          </div>
        ))}
        
        {isThinking && (
           <div className="flex justify-start">
             <div className="bg-white px-5 py-4 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center space-x-2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
           </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your pipeline, specific deals, or negotiation advice..."
            className="w-full resize-none rounded-xl border-slate-300 bg-white focus:border-indigo-500 focus:ring-indigo-500 py-3 pr-12 min-h-[50px] max-h-[150px]"
            rows={1}
            style={{ minHeight: '50px' }}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-xs text-slate-400">
                AI can make mistakes. Verify important info.
            </p>
        </div>
      </div>
    </div>
  );
};