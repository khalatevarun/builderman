import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowUp, Code, Eye, Edit } from 'lucide-react';
import { BACKEND_URL } from '@/utility/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (idea.trim()) {
      navigate('/workspace', { state: { prompt: idea } });
    }
  };

  const enhancePrompt = async () => {
    try {
      setIsEnhancing(true);
      const response = await fetch(`${BACKEND_URL}/enhance-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: idea }),
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      setIdea('');
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) setIdea((c) => c + parsed.text);
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error enhancing prompt:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const features = [
    {
      icon: <Code className="w-6 h-6" />,
      title: 'Production-Ready Code',
      description: 'Get fully functional code instantly from your ideas',
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Live Preview',
      description: 'See your application come to life in real-time',
    },
    {
      icon: <Edit className="w-6 h-6" />,
      title: 'Flexible Editing',
      description: 'Edit via prompts or use the built-in code editor',
    },
  ];

  return (
    <div className="min-h-screen bg-hero-gradient text-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              BuilderMan
            </h1>
          </div>

          <p className="text-white/80 text-xl mb-10 max-w-xl mx-auto">
            Transform your ideas into reality with AI-powered development
          </p>

          {/* Main CTA: large input box with bottom-left enhance and bottom-right arrow */}
          <form ref={formRef} onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto">
            <div className=" flex flex-col rounded-2xl border border-white/25 bg-white/10 shadow-lg overflow-hidden focus-within:bg-white/15 transition-colors">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                placeholder="Describe what you want to build..."
                rows={4}
                className="flex-1  w-full resize-none border-0 bg-transparent py-5 px-5 text-lg md:text-lg text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none shadow-none"
              />
              <div className="flex items-center justify-between px-4 pb-4 pt-2">
                <button
                  type="button"
                  onClick={enhancePrompt}
                  disabled={isEnhancing || !idea.trim()}
                  className="p-2.5 text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:bg-white/10"
                  title="Enhance your prompt for better results"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
                <Button
                  type="submit"
                  disabled={!idea.trim() || isEnhancing}
                  size="icon"
                  className="h-11 w-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl mt-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="rounded-xl border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors text-white"
            >
              <CardContent className="p-6">
                <div className="rounded-lg bg-white/10 p-3 w-fit mb-4 text-primary-foreground">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-white/70">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
