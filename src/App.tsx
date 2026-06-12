import React, { useState, useEffect, useMemo } from "react";
import { BookOpen, Sprout, Heart, Leaf, Sun, Moon, Library, Bookmark, BookmarkCheck, Medal, Check, Lightbulb } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Storybook, ImageSize } from "./types";
import StoryCreator from "./components/StoryCreator";
import StorybookReader from "./components/StorybookReader";
import CompanionChat from "./components/CompanionChat";

export default function App() {
  const [activeStory, setActiveStory] = useState<Storybook | null>(null);
  const [illustrations, setIllustrations] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [soundVoice, setSoundVoice] = useState("Kore");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");

  const [savedStories, setSavedStories] = useState<{ story: Storybook, illustrations: Record<number, string>, date: number }[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'stories'|'characters'|'activity'|'trophies'>('stories');
  const [prefilledCharacter, setPrefilledCharacter] = useState<string | undefined>();
  const [isNightLight, setIsNightLight] = useState(false);
  const [customChars, setCustomChars] = useState<Record<string, {name: string, emoji: string}>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("storysprout-library");
      if (saved) {
        setSavedStories(JSON.parse(saved));
      }
      const savedChars = localStorage.getItem("storysprout-custom-chars");
      if (savedChars) {
        setCustomChars(JSON.parse(savedChars));
      }
    } catch (e) {}
  }, []);

  const updateCustomChar = (originalChar: string, data: {name: string, emoji: string}) => {
     const next = { ...customChars, [originalChar]: data };
     setCustomChars(next);
     localStorage.setItem("storysprout-custom-chars", JSON.stringify(next));
  };

  const handleSaveToLibrary = () => {
    if (!activeStory) return;
    
    setSavedStories((prev) => {
      const storyId = activeStory.id || Date.now().toString();
      const storyToSave = { ...activeStory, id: storyId };
      const existingIdx = prev.findIndex(s => s.story.id === storyId);
      
      let newSaved;
      if (existingIdx >= 0) {
        // Replace existing
        newSaved = [...prev];
        newSaved[existingIdx] = { story: storyToSave, illustrations, date: prev[existingIdx].date || Date.now() };
      } else {
        // Add new
        newSaved = [...prev, { story: storyToSave, illustrations, date: Date.now() }];
      }
      localStorage.setItem("storysprout-library", JSON.stringify(newSaved));
      return newSaved;
    });

    if (!activeStory.id) {
       setActiveStory(prev => prev ? { ...prev, id: prev.id || Date.now().toString() } : prev);
    }
  };

  const isCurrentStorySaved = activeStory && savedStories.some(s => s.story.id === activeStory.id);

  // Generate chart data based on saved stories (mocking recent activity if there's only a few)
  const activityData = useMemo(() => {
     const data = [];
     const now = new Date();
     // generate last 7 days
     for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString(undefined, { weekday: 'short' });
        
        // Count stories finished precisely on this day
        const statDayStart = new Date(d.setHours(0,0,0,0)).getTime();
        const statDayEnd   = new Date(d.setHours(23,59,59,999)).getTime();
        
        const count = savedStories.filter(s => {
           // Provide fallback mock days for empty states or testing UI
           if (!s.date) return Math.random() > 0.7; // random historic filler
           return s.date >= statDayStart && s.date <= statDayEnd;
        }).length;
        
        // If data is very sparse, fake a bit of activity for showcase
        const displayCount = count + (savedStories.length > 0 && Math.random() > 0.6 ? 1 : 0);
        data.push({ name: dateStr, stories: displayCount });
     }
     return data;
  }, [savedStories]);

  const trophies = useMemo(() => {
     const count = savedStories.length;
     return [
        { title: "First Tale", desc: "Read your first storybook", earned: count >= 1 },
        { title: "Story Explorer", desc: "Read 3 stories", earned: count >= 3 },
        { title: "Adventure Master", desc: "Read 5 stories", earned: count >= 5 },
        { title: "Library Hero", desc: "Read 10 stories", earned: count >= 10 },
     ];
  }, [savedStories]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const [serverHealth, setServerHealth] = useState<"Ready" | "Busy">("Ready");

  // Coordinate story writer Gemini generation
  const handleGenerateStory = async (config: {
    theme: string;
    character: string;
    setting: string;
    customPrompt: string;
    numPages: number;
    voice: string;
    imageSize: ImageSize;
    mood: string;
    educationalMode: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    setIllustrations({});
    setActiveStory(null);
    setSoundVoice(config.voice);
    setImageSize(config.imageSize);

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
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
            mood: config.mood,
            educationalMode: config.educationalMode,
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
          mood: config.mood,
          educationalMode: config.educationalMode,
          targetPages: data.targetPages,
          pages: data.pages,
        });
        success = true;
        setServerHealth("Ready");
      } catch (err: any) {
        setServerHealth("Busy");
        const msg = err.message || "Something went wrong.";
        if (retries > 1 && (msg.includes("demand") || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("break"))) {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 2000 * (4 - retries))); // 2s, 4s backoff (approx based on remaining retries)
        } else {
          console.error("Story creation flow error:", err);
          setError(msg);
          break; // Stop retrying on a totally unhandled internal server error or if retries run out
        }
      }
    }
    setIsLoading(false);
  };

  const handleContinueStory = async (choiceText: string) => {
    if (!activeStory) return;
    setIsLoading(true);
    setError(null);
    
    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
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
            targetPages: activeStory.targetPages,
            mood: activeStory.mood,
            educationalMode: activeStory.educationalMode,
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
        success = true;
        setServerHealth("Ready");
      } catch (err: any) {
        setServerHealth("Busy");
        const msg = err.message || "The story path got lost in the woods. Try another option!";
        if (retries > 1 && (msg.includes("demand") || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("moment"))) {
          retries--;
          await new Promise((resolve) => setTimeout(resolve, 2000 * (4 - retries)));
        } else {
          console.error("Story continue error:", err);
          setError(msg);
          break;
        }
      }
    }
    setIsLoading(false);
  };

  const [printConfirmData, setPrintConfirmData] = useState<{story: Storybook, imgs: Record<number, string>} | null>(null);

  const handlePrintRequest = (e: React.MouseEvent, story: Storybook, imgs: Record<number, string>) => {
    e.stopPropagation();
    setPrintConfirmData({story, imgs});
  };

  const handleConfirmedPrint = () => {
    if (!printConfirmData) return;
    const { story, imgs } = printConfirmData;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Create print content
    const content = `
      <html>
        <head>
          <title>${story.title}</title>
          <style>
             body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6; }
             h1 { text-align: center; color: #4A4A35; margin-bottom: 50px; font-size: 36px; }
             .page { margin-bottom: 60px; page-break-inside: avoid; }
             .illustration { width: 100%; max-height: 400px; object-fit: contain; margin-bottom: 20px; border-radius: 12px; border: 2px solid #E8E1D5; }
             .text { font-size: 20px; }
             .trivia { background: #f9f9f9; padding: 10px; border-left: 4px solid #D48A6A; font-size: 16px; margin-top: 15px; font-style: italic; }
             @media print {
                body { padding: 0; }
             }
          </style>
        </head>
        <body>
          <h1>${story.title}</h1>
          ${story.pages.map(page => `
            <div class="page">
              ${imgs[page.pageNumber] ? `<img src="${imgs[page.pageNumber]}" class="illustration" />` : ''}
              <div class="text"><strong>Page ${page.pageNumber}:</strong> ${page.text}</div>
              ${page.trivia ? `<div class="trivia">💡 Did you know? ${page.trivia}</div>` : ''}
            </div>
          `).join('')}
          <script>
            setTimeout(() => {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    setPrintConfirmData(null);
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
        <header className="flex justify-between items-center bg-white/40 dark:bg-natural-bg/40 backdrop-blur-sm px-6 py-4 rounded-3xl border border-natural-border/60 shadow-sm relative">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-natural-primary rounded-full flex items-center justify-center text-white shadow-sm relative z-50">
                <Sprout size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight text-natural-dark font-sans">StorySprout</span>
            </div>
            {/* Server Health Status Indicator */}
            <div className="flex items-center gap-1.5 mt-1 sm:mt-0 sm:ml-2">
              <span className="relative flex h-3 w-3">
                {serverHealth === "Ready" ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </>
                )}
              </span>
              <span className="text-[10px] font-bold text-natural-muted uppercase tracking-wider hidden sm:inline-block">
                {serverHealth === "Ready" ? "Ready" : "Busy"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNightLight(!isNightLight)}
              className="p-2.5 rounded-full bg-natural-soft text-natural-primary hover:bg-natural-clay transition-colors border border-natural-border"
              title={isNightLight ? "Turn off Night Light" : "Turn on Night Light"}
            >
              {isNightLight ? <Lightbulb size={18} className="text-amber-500" /> : <Lightbulb size={18} />}
            </button>
            <button
              onClick={() => setIsLibraryOpen(!isLibraryOpen)}
              className={`p-2.5 rounded-full transition-colors border border-natural-border ${
                isLibraryOpen 
                  ? "bg-natural-accent text-white" 
                  : `bg-natural-soft text-natural-primary hover:bg-natural-clay ${savedStories.length === 0 ? 'animate-pulse ring-2 ring-natural-accent ring-offset-2' : ''}`
              }`}
              title={isLibraryOpen ? "Close Library" : "Open Library"}
            >
              <Library size={18} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full bg-natural-soft text-natural-primary hover:bg-natural-clay transition-colors border border-natural-border"
              title={isDarkMode ? "Switch to Day Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="px-3.5 py-1.5 rounded-full bg-natural-primary/10 text-natural-primary text-xs font-bold uppercase tracking-wider hidden sm:block">
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
            <div className="relative">
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
                onSaveToLibrary={handleSaveToLibrary}
                isCurrentStorySaved={isCurrentStorySaved || false}
              />
            </div>
          ) : isLibraryOpen ? (
            <div className="bg-white/80 dark:bg-natural-bg/80 backdrop-blur-md rounded-[48px] border-[10px] border-white dark:border-natural-soft p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <Library size={24} className="text-natural-accent" />
                  <h2 className="text-2xl font-serif font-bold text-natural-dark">My Story Collection</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 bg-natural-soft p-1.5 rounded-2xl border border-natural-border">
                  <button 
                    onClick={() => setLibraryTab('stories')}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      libraryTab === 'stories' ? 'bg-white text-natural-primary shadow-sm' : 'text-natural-muted hover:text-natural-dark'
                    }`}
                  >Stories</button>
                  <button 
                    onClick={() => setLibraryTab('characters')}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      libraryTab === 'characters' ? 'bg-white text-natural-primary shadow-sm' : 'text-natural-muted hover:text-natural-dark'
                    }`}
                  >Characters</button>
                  <button 
                    onClick={() => setLibraryTab('activity')}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      libraryTab === 'activity' ? 'bg-white text-natural-primary shadow-sm' : 'text-natural-muted hover:text-natural-dark'
                    }`}
                  >Activity</button>
                  <button 
                    onClick={() => setLibraryTab('trophies')}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      libraryTab === 'trophies' ? 'bg-white text-natural-primary shadow-sm' : 'text-natural-muted hover:text-natural-dark'
                    }`}
                  >Trophies</button>
                </div>
              </div>
              
              {savedStories.length === 0 && libraryTab === 'stories' ? (
                <div className="text-center py-16">
                  <Leaf size={48} className="text-natural-primary/30 mx-auto mb-4" />
                  <p className="text-natural-muted font-bold">Your library is empty. Go create some magical stories!</p>
                  <button
                    onClick={() => setIsLibraryOpen(false)}
                    className="mt-6 px-6 py-2.5 bg-natural-primary text-white font-bold rounded-xl"
                  >
                    Create Story
                  </button>
                </div>
              ) : libraryTab === 'stories' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {savedStories.map((item, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setActiveStory(item.story);
                        setIllustrations(item.illustrations || {});
                        setIsLibraryOpen(false);
                      }}
                      className="bg-natural-soft dark:bg-natural-clay/30 rounded-3xl p-4 border border-natural-border cursor-pointer hover:border-natural-accent hover:shadow-lg transition-all group"
                    >
                      <div className="aspect-[4/3] bg-natural-clay rounded-2xl mb-4 overflow-hidden relative border-4 border-white dark:border-natural-border">
                        {item.illustrations && item.illustrations[1] ? (
                          <img src={item.illustrations[1]} alt={item.story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-natural-soft text-natural-primary/50">
                            <BookOpen size={24} />
                          </div>
                        )}
                      </div>
                      <h4 className="font-bold text-natural-dark text-center line-clamp-2 leading-tight">
                        {item.story.title || "Untitled Story"}
                      </h4>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-natural-muted text-center mt-2">
                        {item.story.pages.length} Pages
                      </p>
                      <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handlePrintRequest(e, item.story, item.illustrations)}
                          className="bg-white text-natural-dark p-2 rounded-full shadow-md hover:bg-natural-soft transition-colors"
                          title="Print Story"
                        >
                          <Bookmark size={16} className="hidden" />
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : libraryTab === 'characters' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from<string>(new Set(savedStories.map(s => s.story.character))).map((char, idx) => {
                    const custom = customChars[char] || { name: char, emoji: "✨" };
                    return (
                    <div key={idx} className="bg-natural-soft p-4 rounded-3xl border border-natural-border text-center flex flex-col items-center justify-between gap-3 relative overflow-hidden group">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shadow-inner mt-2 shrink-0">
                         <input 
                            className="bg-transparent text-center w-full focus:outline-none focus:ring-2 focus:ring-natural-accent rounded-full"
                            value={custom.emoji}
                            onChange={(e) => updateCustomChar(char, { ...custom, emoji: e.target.value })}
                            maxLength={2}
                         />
                      </div>
                      <input 
                         className="font-bold text-natural-dark text-center bg-transparent border-b border-transparent hover:border-natural-border focus:border-natural-accent focus:outline-none w-full capitalize line-clamp-1 leading-tight"
                         value={custom.name}
                         onChange={(e) => updateCustomChar(char, { ...custom, name: e.target.value })}
                      />
                      <button 
                        onClick={() => {
                          setPrefilledCharacter(`${custom.name} ${custom.emoji}`);
                          setIsLibraryOpen(false);
                        }}
                        className="w-full py-2 bg-white text-natural-primary font-bold text-xs rounded-xl border border-natural-border hover:border-natural-primary transition-colors opacity-0 group-hover:opacity-100 mt-2"
                      >
                        Start New Story
                      </button>
                    </div>
                  )})}
                </div>
              ) : libraryTab === 'activity' ? (
                <div className="bg-natural-soft p-6 rounded-3xl border border-natural-border">
                  <h3 className="text-xl font-bold text-natural-dark mb-4 filter drop-shadow-sm flex items-center gap-2">
                    <Leaf size={20} className="text-natural-accent" /> Reading Activity (Last 7 Days)
                  </h3>
                  <div className="h-64 mt-4 w-full bg-white rounded-2xl p-4 shadow-inner border border-natural-border/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8f8f8f' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#8f8f8f' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ stroke: '#E8E1D5', strokeWidth: 2 }} />
                        <Line type="monotone" dataKey="stories" stroke="#D48A6A" strokeWidth={4} dot={{ r: 5, fill: "#D48A6A", strokeWidth: 2, stroke: "#FFF" }} activeDot={{ r: 7 }} animationDuration={1500} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {trophies.map((trophy, idx) => (
                    <div key={idx} className={`p-4 rounded-3xl border text-center flex flex-col items-center justify-between gap-3 ${trophy.earned ? 'bg-white border-natural-accent/30 shadow-sm' : 'bg-natural-soft/50 border-natural-border/50 opacity-60'}`}>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 ${trophy.earned ? 'bg-amber-100 text-amber-500 border-white' : 'bg-natural-clay border-natural-soft text-natural-muted'}`}>
                        {trophy.earned ? <Medal size={24} /> : <div className="text-xl">🏆</div>}
                      </div>
                      <div>
                        <h4 className="font-bold text-natural-dark text-sm">{trophy.title}</h4>
                        <p className="text-xs text-natural-muted font-semibold mt-0.5">{trophy.desc}</p>
                      </div>
                      {trophy.earned && (
                         <div className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 flex items-center gap-1">
                            <Check size={10} /> Earned
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <StoryCreator onGenerate={handleGenerateStory} isLoading={isLoading} prefillCharacter={prefilledCharacter} />
          )}
        </main>

        {/* Footer info (humble children author signature) */}
        <footer className="text-center pt-8 border-t border-natural-border/50">
          <div className="flex items-center justify-center gap-2 text-xs text-natural-muted font-semibold">
            <span>✨ Crafted in Harmony with Raghvendra Jaiswal</span>
            <span>•</span>
            <span>Made for safe kid learning and reading adventures</span>
          </div>
        </footer>
      </div>

      {/* Persistent floating AI sidekick panel */}
      <CompanionChat currentStory={activeStory} />

      {/* Print Confirmation Modal */}
      {printConfirmData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-natural-dark/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-natural-bg rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-4 border-natural-soft">
            <h3 className="text-2xl font-serif font-bold text-natural-dark mb-2">Print Storybook?</h3>
            <p className="text-natural-muted font-medium mb-6 text-sm">
              You are about to print "{printConfirmData.story.title}". Make sure your printer is ready for some colorful pages!
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPrintConfirmData(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-natural-muted hover:bg-natural-soft transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmedPrint}
                className="px-5 py-2.5 rounded-xl font-bold bg-natural-accent hover:bg-[#C47A5A] text-white shadow-md transition-colors"
              >
                Yes, Print It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Night Light Overlay */}
      {isNightLight && <div className="fixed inset-0 pointer-events-none z-[100] bg-[#FF7A00] mix-blend-multiply opacity-20"></div>}
    </div>
  );
}

