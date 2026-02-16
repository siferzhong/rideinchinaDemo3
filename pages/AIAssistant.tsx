
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; image?: string }[]>([
    { role: 'ai', text: "Hello! I'm your Ride In China digital guide. I can help you translate Chinese traffic signs, explain road rules, or plan stops along your route. How can I assist you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (image?: string) => {
    const userText = input.trim();
    if (!userText && !image) return;

    const newMessage = { role: 'user' as const, text: userText, image };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Correct: Use process.env.API_KEY directly as a named parameter
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = image 
        ? `I am a foreign motorcycle rider in China. ${userText || "What does this sign mean?"} Keep the answer practical for a rider.`
        : userText;

      let responseText = "";
      
      if (image) {
        // Image processing with Gemini
        const base64Data = image.split(',')[1];
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
              { text: prompt }
            ]
          }
        });
        // Correct: Access .text property directly, not as a method
        responseText = response.text || "I couldn't process that image. Please try again.";
      } else {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: "You are a helpful motorcycle touring guide for Ride In China. You help foreign riders navigate Chinese roads, translate road signs (especially restrictive ones), explain traffic regulations, and recommend local etiquette. Keep responses concise and focused on safety and local logistics."
          }
        });
        // Correct: Access .text property directly, not as a method
        responseText = response.text || "I'm having trouble connecting right now.";
      }

      setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I ran into an error. Make sure your internet connection is stable." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSend(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 hide-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              m.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
            }`}>
              {m.image && <img src={m.image} className="w-full h-auto rounded-lg mb-2 shadow-sm" alt="User upload" />}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 flex gap-2">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200 pb-20">
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-2 pr-3">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={onFileChange} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-300 transition-colors"
          >
            <i className="fa-solid fa-camera"></i>
          </button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your guide anything..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm py-2 px-1"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() && !isTyping}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              input.trim() ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 bg-slate-200'
            }`}
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
          <QuickPrompt label="Translate this sign" icon="fa-language" onClick={() => fileInputRef.current?.click()} />
          <QuickPrompt label="Road Rules" icon="fa-gavel" onClick={() => setInput("Tell me about China's motorcycle road rules.")} />
          <QuickPrompt label="Find Fuel" icon="fa-gas-pump" onClick={() => setInput("Where can I find 95 octane fuel nearby?")} />
        </div>
      </div>
    </div>
  );
};

const QuickPrompt: React.FC<{ label: string; icon: string; onClick: () => void }> = ({ label, icon, onClick }) => (
  <button 
    onClick={onClick}
    className="bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 whitespace-nowrap flex items-center gap-2 hover:bg-slate-50"
  >
    <i className={`fa-solid ${icon} text-orange-500`}></i>
    {label}
  </button>
);

export default AIAssistant;
