import React, { useState } from "react";
import { BookOpen, Sprout, Heart, Leaf } from "lucide-react";
import { Storybook, ImageSize } from "./types";
import StoryCreator from "./components/StoryCreator";
import StorybookReader from "./components/StorybookReader";
import CompanionChat from "./components/CompanionChat";

export default function App() {
  const [activeStory, setActiveStory] = useState<Storybook | null>(null);
  const [illustrations, setIllustrations] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [soundVoice, setSoundVoice] = useState("Kore");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");

  // Coordinate story writer Gemini generation
  const handleGenerateStory = async (config: {
    theme: string;
    character: string;
    setting: string;
    customPrompt: string;
    numPages: number;
    voice: string;
    imageSize: ImageSize;
  }) => {
    setIsLoading(true);
    setError(null);
    setIllustrations({});
    setActiveStory(null);
    setSoundVoice(config.voice);
    setImageSize(config.imageSize);

    try {
      const res = await fetch("/api/story/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: config.theme,
          character: config.character,
          setting: config.setting,
          customPrompt: config.customPrompt,
          numPages: config.numPages,
        }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setActiveStory({
        title: data.title,
        theme: config.theme,
        character: config.character,
        setting: config.setting,
        customPrompt: config.customPrompt,
        targetPages: data.targetPages,
        pages: data.pages,
      });
    } catch (err: any) {
      console.error("Story creation flow error:", err);
      setError(err.message || "Our happy storytelling fairies are taking a brief nap. Please try again in a moment!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueStory = async (choiceText: string) => {
    if (!activeStory) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const nextPageNum = activeStory.pages.length + 1;
      const res = await fetch("/api/story/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeStory.title,
          previousPages: activeStory.pages,
          choice: choiceText,
          nextPageNum,
          targetPages: activeStory.targetPages
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setActiveStory(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pages: [...prev.pages, data.page]
        };
      });
    } catch (err: any) {
      console.error("Story continue error:", err);
      setError(err.message || "The story path got lost in the woods. Try another option!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateIllustration = (pageNumber: number, imageUrl: string) => {
    setIllustrations((prev) => ({
      ...prev,
      [pageNumber]: imageUrl,
    }));
  };

  return (
    <div className="min-h-screen bg-natural-bg py-10 px-4 sm:px-6 relative selection:bg-natural-border selection:text-natural-dark pb-24 font-sans">
      {/* Decorative organic icons matching Natural Tones style */}
      <div className="absolute top-10 left-10 text-natural-primary/20 pointer-events-none animate-pulse">
        <Leaf size={40} className="rotate-45" />
      </div>
      <div className="absolute top-20 right-14 text-natural-accent/20 pointer-events-none animate-bounce delay-100">
        <Sprout size={32} />
      </div>
      <div className="absolute bottom-24 left-16 text-natural-primary/20 pointer-events-none animate-pulse">
        <Leaf size={36} className="-rotate-12" />
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Navigation consistent with Natural Tones Design mockup style */}
        <header className="flex justify-between items-center bg-white/40 backdrop-blur-sm px-6 py-4 rounded-3xl border border-natural-border/60 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-natural-primary rounded-full flex items-center justify-center text-white shadow-sm">
              <Sprout size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-natural-dark font-sans">StorySprout</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full bg-natural-primary/10 text-natural-primary text-xs font-bold uppercase tracking-wider">
              {activeStory ? "🌿 Reading Studio" : "🎨 Creator Studio"}
            </span>
          </div>
        </header>

        {/* Main Logo / Title Area */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-natural-primary text-white font-bold text-xs uppercase tracking-wider px-4 py-1.5 rounded-full shadow-sm">
            <BookOpen size={14} />
            <span>AI Story Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-serif font-black text-natural-dark tracking-tight leading-none">
            Magic Voice <span className="text-natural-accent">Storybook</span>
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-natural-muted font-medium leading-relaxed">
            Where child imaginations grow into hand-painted storybooks that play beautiful aloud voiceovers and read with forest companions!
          </p>
        </div>

        {/* Error notification styled with natural warning tones */}
        {error && (
          <div className="bg-rose-50/50 border-2 border-rose-200 rounded-3xl p-5 text-rose-800 text-center relative overflow-hidden">
            <h4 className="font-extrabold text-sm sm:text-base">🌿 A small seed needs some fresh rain:</h4>
            <p className="font-semibold text-xs sm:text-sm mt-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-3 bg-natural-accent hover:bg-natural-accent/90 text-white font-extrabold px-4 py-1.5 rounded-xl text-xs transition shadow"
            >
              Let's try again!
            </button>
          </div>
        )}

        {/* Story Master Stage */}
        <main id="storybook-main-container" className="relative">
          {activeStory ? (
            <StorybookReader
              story={activeStory}
              illustrations={illustrations}
              onUpdateIllustration={handleUpdateIllustration}
              voice={soundVoice}
              imageSize={imageSize}
              onChangeImageSize={(size) => setImageSize(size)}
              onClose={() => setActiveStory(null)}
              onContinue={handleContinueStory}
              isContinuing={isLoading}
            />
          ) : (
            <StoryCreator onGenerate={handleGenerateStory} isLoading={isLoading} />
          )}
        </main>

        {/* Footer info (humble children author signature) */}
        <footer className="text-center pt-8 border-t border-natural-border/50">
          <div className="flex items-center justify-center gap-2 text-xs text-natural-muted font-semibold">
            <span>✨ Crafted in Harmony with Google Gemini</span>
            <span>•</span>
            <span>Made for safe kid learning and reading adventures</span>
          </div>
        </footer>
      </div>

      {/* Persistent floating AI sidekick panel */}
      <CompanionChat currentStory={activeStory} />
    </div>
  );
}

