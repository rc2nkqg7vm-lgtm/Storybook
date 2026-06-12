import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, ChevronLeft, ChevronRight, Play, Square,
  RotateCcw, Sparkles, Image as ImageIcon, RefreshCw, Volume2, ArrowLeft, Loader2, Leaf, MoveRight, Bookmark, BookmarkCheck, Music
} from "lucide-react";
import { Storybook, ImageSize } from "../types";

interface StorybookReaderProps {
  story: Storybook;
  illustrations: Record<number, string>; // pageNumber => dataUrl
  voice: string;
  imageSize: ImageSize;
  onUpdateIllustration: (pageNumber: number, imageUrl: string) => void;
  onClose: () => void;
  onChangeImageSize: (size: ImageSize) => void;
  onContinue: (choice: string) => void;
  isContinuing: boolean;
  onSaveToLibrary: () => void;
  isCurrentStorySaved: boolean;
}

export default function StorybookReader({
  story,
  illustrations,
  voice,
  imageSize,
  onUpdateIllustration,
  onClose,
  onChangeImageSize,
  onContinue,
  isContinuing,
  onSaveToLibrary,
  isCurrentStorySaved,
}: StorybookReaderProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [playingPage, setPlayingPage] = useState<number | null>(null);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});

  const [activeSource, setActiveSource] = useState<AudioBufferSourceNode | null>(null);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  const [highlightWordIdx, setHighlightWordIdx] = useState(-1);
  const [narrationSpeed, setNarrationSpeed] = useState<number>(1);
  const [fontSize, setFontSize] = useState<"Small" | "Medium" | "Large">("Medium");
  const playAnimationRef = useRef<number>();
  
  // Glossary state
  const [glossaryWord, setGlossaryWord] = useState<string | null>(null);
  const [glossaryDef, setGlossaryDef] = useState<{def: string; img: string | null} | null>(null);
  const [glossaryLoading, setGlossaryLoading] = useState(false);

  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Optional: save doodles per page so they persist on navigation
  const [doodles, setDoodles] = useState<Record<number, string>>({});

  const ambientAudioRefs = useRef<HTMLAudioElement[]>([]);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const musicCtxRef = useRef<AudioContext | null>(null);
  const musicOscRef = useRef<OscillatorNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      if (musicCtxRef.current) {
        musicCtxRef.current.close();
      }
    };
  }, []);

  const toggleMusic = () => {
    if (isMusicPlaying) {
      if (musicCtxRef.current) {
        musicCtxRef.current.close();
        musicCtxRef.current = null;
      }
      setIsMusicPlaying(false);
      return;
    }
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    musicCtxRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Simple ambient settings based on mood
    const m = story.mood ? story.mood.toLowerCase() : "";
    if (m.includes('sleepy') || m.includes('calming')) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, ctx.currentTime);
    } else if (m.includes('adventurous') || m.includes('bold')) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
    } else if (m.includes('spooky')) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, ctx.currentTime);
    } else { // happy
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
    }

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 2); // very soft

    // Adds a tiny bit of LFO for "ambient pulse"
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.1, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.01, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    osc.start();
    
    musicOscRef.current = osc;
    musicGainRef.current = gain;
    setIsMusicPlaying(true);
  };

  // Setup canvas size
  useEffect(() => {
    if (canvasRef.current) {
      const container = canvasRef.current.parentElement;
      if (container) {
        canvasRef.current.width = container.clientWidth;
        canvasRef.current.height = container.clientHeight;
      }
      
      // Load saved doodle for current page if exists
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        if (doodles[currentPage]) {
          const img = new window.Image();
          img.src = doodles[currentPage];
          img.onload = () => {
             ctx.drawImage(img, 0, 0);
          };
        }
      }
    }
  }, [currentPage, isDrawingMode]);

  const startDrawing = (e: React.PointerEvent) => {
    if (!isDrawingMode || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#D48A6A'; // Natural accent
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      // Save canvas state
      setDoodles(prev => ({
        ...prev,
        [currentPage]: canvasRef.current!.toDataURL()
      }));
    }
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
       const ctx = canvasRef.current.getContext('2d');
       if (ctx) {
         ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
         setDoodles(prev => {
            const next = { ...prev };
            delete next[currentPage];
            return next;
         });
       }
    }
  };

  // Function to play sound effect based on text matching
  const playAmbientSound = (text: string) => {
    const textLower = text.toLowerCase();
    
    // Some sample mappings 
    // Usually these would be actual loaded audio files from the backend, 
    // but we can set up simple generated beeps/noise or assume public domain audio urls.
    // For this context, we will use a small synthesized envelope since we can't load real files reliably.
    
    // We will use the web audio API we already have to build a gentle synth
    if (audioCtx) {
      if (textLower.includes("rain") || textLower.includes("storm")) {
        createNoiseSynth("rain");
      }
      if (textLower.includes("bird") || textLower.includes("fly") || textLower.includes("wings")) {
        createBirdSynth();
      }
      if (textLower.includes("magic") || textLower.includes("sparkle") || textLower.includes("glow")) {
        createChimeSynth();
      }
    }
  };

  const createNoiseSynth = (type: string) => {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; 
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = type === "rain" ? "lowpass" : "highpass";
    filter.frequency.value = 1000;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.5);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noise.start();
  };

  const createBirdSynth = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    const gainNode = audioCtx.createGain();
    
    osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  };

  const createChimeSynth = () => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    const gainNode = audioCtx.createGain();
    
    osc.frequency.setValueAtTime(1500, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
  };

  // Handle glossary click
  const handleWordClick = async (rawWord: string) => {
    const word = rawWord.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (word.length < 3) return; // Skip very short words like "a", "it", "to"

    setGlossaryWord(word);
    setGlossaryLoading(true);
    setGlossaryDef(null);
    try {
      const res = await fetch("/api/story/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = await res.json();
      if (!data.error) {
        setGlossaryDef({ def: data.definition, img: data.imageUrl });
      } else {
         setGlossaryWord(null);
      }
    } catch {
      setGlossaryWord(null);
    } finally {
      setGlossaryLoading(false);
    }
  };

  const { title, pages } = story;
  const page = pages?.[currentPage - 1];

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full w-full bg-natural-bg rounded-3xl">
        <Loader2 className="animate-spin text-natural-accent mb-4" size={48} />
        <h2 className="text-xl font-bold text-natural-dark">Turning the page...</h2>
      </div>
    );
  }

  // Turn page - ensures we stop playing any audio
  const handlePageChange = (direction: "next" | "prev") => {
    stopAloud();
    if (direction === "next" && currentPage < pages.length) {
      setCurrentPage((prev) => prev + 1);
    } else if (direction === "prev" && currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Stop current voice speech
  const stopAloud = () => {
    if (activeSource) {
      try {
        activeSource.stop();
      } catch (e) {}
      setActiveSource(null);
    }
    if (audioCtx) {
      try {
        audioCtx.close();
      } catch (e) {}
      setAudioCtx(null);
    }
    setPlayingPage(null);
  };

  // Convert text-to-speech using gemini-3.1-flash-tts-preview & play raw PCM
  const playAloud = async () => {
    if (playingPage === currentPage) {
      stopAloud();
      return;
    }

    stopAloud();
    setVoiceLoading(true);

    try {
      let base64Data = audioCache[currentPage];

      if (!base64Data) {
        const res = await fetch("/api/story/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: page.text, voice }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        base64Data = data.base64Audio;
        setAudioCache((prev) => ({ ...prev, [currentPage]: base64Data }));
      }

      // Convert Base64 PCM elements (little-endian, raw 16-bit) to float buffers for AudioContext at 24000Hz (TTS response standard)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      setAudioCtx(ctx);

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const rawData = new Int16Array(bytes.buffer);
      const audioBuffer = ctx.createBuffer(1, rawData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);

      // Normalize Int16 short samples into floating point [-1.0, 1.0]
      for (let i = 0; i < rawData.length; i++) {
        channelData[i] = rawData[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlayingPage(null);
      };

      source.playbackRate.value = narrationSpeed;
      source.start(0);
      setActiveSource(source);
      setPlayingPage(currentPage);
    } catch (err: any) {
      console.error("TTS play error:", err);
      alert("Uh oh, our forest narrator voicebox is resting: " + err.message);
    } finally {
      setVoiceLoading(false);
    }
  };

  // Generate or regenerate illustration using gemini-3-pro-image-preview
  const paintIllustration = async (forceRegen = false) => {
    if (illustrations[currentPage] && !forceRegen) {
      return;
    }

    setImageLoading(true);
    setImageError(null);

    try {
      const res = await fetch("/api/story/illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePrompt: page.imagePrompt,
          imageSize: imageSize, // Pass size chosen via affordance (1K, 2K, 4K)
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onUpdateIllustration(currentPage, data.imageUrl);
    } catch (err: any) {
      console.error("Illustration painting failed:", err);
      setImageError("The paintbrush was blown over by a breeze! Click repaint to wave the wand again.");
    } finally {
      setImageLoading(false);
    }
  };

  // Paint of current page automatically if missing
  useEffect(() => {
    if (page && !illustrations[currentPage] && !imageLoading) {
      paintIllustration();
    }
  }, [currentPage, page]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAloud();
    };
  }, []);

  // When a new page is appended via continuing the story, flip to it!
  useEffect(() => {
    if (pages.length > currentPage && !isContinuing) {
      setCurrentPage(pages.length);
    }
  }, [pages.length, isContinuing]);

  // Read-Along highlighting sync
  useEffect(() => {
    if (playingPage === currentPage && audioCtx && activeSource) {
      const startTime = audioCtx.currentTime;
      const duration = (activeSource.buffer?.duration || 1) / narrationSpeed;
      
      const updateHighlight = () => {
        if (!page) return;
        const elapsed = audioCtx.currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        // Update visual timer if it exists. We check by ID to avoid refs overhead
        const timerBubble = document.getElementById("narration-timer-progress");
        if (timerBubble) {
           timerBubble.style.width = `${progress * 100}%`;
        }
        const timerText = document.getElementById("narration-timer-text");
        if (timerText) {
           const remain = Math.max(0, duration - elapsed);
           timerText.innerText = Math.ceil(remain) + "s";
        }
        
        const totalChars = (page.text || "").length;
        const targetCharIdx = progress * totalChars;
        
        let charAcc = 0;
        let foundWordIdx = -1;
        const renderWords = (page.text || "").split(" ");
        
        for (let i = 0; i < renderWords.length; i++) {
          charAcc += renderWords[i].length + 1; // +1 for the space
          if (targetCharIdx <= charAcc) {
            foundWordIdx = i;
            break;
          }
        }
        
        setHighlightWordIdx(foundWordIdx);
        
        if (progress < 1.0) {
          playAnimationRef.current = requestAnimationFrame(updateHighlight);
        } else {
          setHighlightWordIdx(-1);
        }
      };
      
      playAnimationRef.current = requestAnimationFrame(updateHighlight);
    } else {
      setHighlightWordIdx(-1);
      if (playAnimationRef.current) cancelAnimationFrame(playAnimationRef.current);
    }
    
    return () => {
      if (playAnimationRef.current) cancelAnimationFrame(playAnimationRef.current);
    };
  }, [playingPage, currentPage, audioCtx, activeSource, page?.text]);

  const hasImage = !!illustrations[currentPage];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Upper Navigation & Affordances */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 dark:bg-natural-bg/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-natural-border shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 bg-natural-soft hover:bg-natural-clay/50 text-natural-dark font-bold rounded-2xl border border-natural-border/60 text-xs sm:text-sm transition-all"
        >
          <ArrowLeft size={14} /> Close Book
        </button>

        <div className="flex-1 max-w-sm mx-auto px-4 hidden sm:block">
          <div className="flex flex-col gap-1 items-center mb-1">
            <span className="text-[10px] font-bold text-natural-primary uppercase tracking-wider">
              {pages.length - currentPage} pages left
            </span>
            <div className="w-full h-2 bg-natural-soft rounded-full overflow-hidden">
              <div 
                className="h-full bg-natural-primary rounded-full transition-all duration-300" 
                style={{ width: `${(currentPage / pages.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMusic}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all text-xs ${
              isMusicPlaying
                ? "bg-natural-accent/10 border-natural-accent text-natural-accent pointer-events-auto"
                : "bg-white dark:bg-natural-soft text-natural-dark border-natural-border hover:border-natural-accent/50"
            }`}
            title="Music Theme"
          >
            <Music size={14} className={isMusicPlaying ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">Music</span>
          </button>
          
          <button
            onClick={onSaveToLibrary}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold border transition-all text-xs ${
              isCurrentStorySaved
                ? "bg-natural-soft text-natural-accent border-natural-accent/30"
                : "bg-white dark:bg-natural-soft text-natural-dark border-natural-border hover:border-natural-accent/50"
            }`}
          >
            {isCurrentStorySaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            <span className="hidden sm:inline">{isCurrentStorySaved ? "Saved" : "Save"}</span>
          </button>

          {/* Quality Size Controls: Direct requirement satisfying affordance */}
          <div className="flex items-center gap-1.5 bg-natural-soft/70 p-1 rounded-2xl border border-natural-border">
            <span className="text-xs font-bold text-natural-muted px-2 flex items-center gap-1 hidden sm:flex">
              <ImageIcon size={11} /> Size:
            </span>
            {(["1K", "2K", "4K"] as ImageSize[]).map((size) => (
              <button
                key={size}
                onClick={() => {
                  onChangeImageSize(size);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all ${
                  imageSize === size
                    ? "bg-natural-primary text-white shadow-sm"
                    : "text-natural-muted hover:bg-natural-clay/40"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Storybook Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Art Illustration Panel with gorgeous Natural Tones double border frame */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#EBE5D9] dark:bg-natural-clay rounded-[48px] md:rounded-[56px] border-[8px] md:border-[12px] border-white dark:border-natural-soft aspect-[4/3] flex items-center justify-center relative overflow-hidden shadow-2xl min-h-[300px]">
            {imageLoading ? (
              <div className="absolute inset-0 bg-natural-dark/90 flex flex-col items-center justify-center p-6 text-center z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="mb-4 text-natural-accent"
                >
                  <Sparkles size={48} />
                </motion.div>
                <h4 className="text-white font-serif font-bold text-lg">Painting magical scenery...</h4>
                <p className="text-natural-soft/80 text-xs mt-1.5 max-w-sm">
                  Arranging organic pigments for your {imageSize === "1K" ? "standard" : imageSize === "2K" ? "high-definition" : "ultra-magical 4K"} storybook canvas!
                </p>
                <div className="w-48 bg-white/20 h-2 rounded-full mt-4 overflow-hidden">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="w-1/2 bg-natural-accent h-full rounded-full"
                  />
                </div>
              </div>
            ) : null}

            {imageError ? (
              <div className="absolute inset-x-6 top-6 bg-natural-accent/95 border-2 border-white text-white p-4 rounded-2xl text-center z-10 shadow-lg">
                <p className="text-xs sm:text-sm font-semibold">{imageError}</p>
                <button
                  onClick={() => paintIllustration(true)}
                  className="mt-3 bg-white text-natural-accent font-bold text-xs px-4 py-2 rounded-xl border border-natural-border"
                >
                  Regenerate Art
                </button>
              </div>
            ) : null}

            {/* Render painting if exists */}
            {hasImage ? (
              <img
                key={`${currentPage}-${illustrations[currentPage]}`}
                src={illustrations[currentPage]}
                alt="Colorful illustration"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none"
              />
            ) : (
              !imageLoading && (
                <div className="flex flex-col items-center p-6 text-center">
                  <Leaf size={40} className="text-natural-primary/50 animate-pulse mb-3" />
                  <p className="text-natural-muted font-bold text-sm">Preparing forest canvas is empty...</p>
                </div>
              )
            )}

            {/* Page number badge consistently themed */}
            <div className="absolute bottom-4 left-4 bg-natural-dark/80 backdrop-blur-md text-white font-bold px-3.5 py-1.5 rounded-full text-xs z-30">
              Page {currentPage} of {pages.length}
            </div>

            {/* Drawing Canvas Over Illustration */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full cursor-crosshair touch-none transition-opacity duration-300 ${isDrawingMode ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none'}`}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerLeave={stopDrawing}
            />

            {/* Repaint and Drawing Mode Affordances beautifully matched to Natural Tones style */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 z-30">
              {isDrawingMode && (
                 <button
                   onClick={clearCanvas}
                   className="bg-white/90 dark:bg-natural-bg/90 hover:bg-white text-natural-dark px-3 py-2 rounded-full text-xs font-extrabold transition-all shadow-sm border border-natural-border/60"
                 >
                   Clear
                 </button>
              )}
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                title={isDrawingMode ? "Stop drawing" : "Draw over image"}
                className={`backdrop-blur-md px-4 py-2 rounded-full text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm border border-natural-border/60 ${isDrawingMode ? "bg-natural-primary text-white border-transparent" : "bg-white/90 dark:bg-natural-bg/90 text-natural-primary hover:bg-white"}`}
              >
                <span>✏️ {isDrawingMode ? "Done" : "Doodle"}</span>
              </button>

              <button
                onClick={() => paintIllustration(true)}
                title="Repaint page"
                disabled={imageLoading}
                className="bg-white/90 dark:bg-natural-bg/90 hover:bg-white dark:hover:bg-natural-bg text-natural-accent hover:text-natural-accent/80 backdrop-blur-md px-4 py-2 rounded-full text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm border border-natural-border/60 disabled:opacity-50"
              >
                <RefreshCw size={13} className={imageLoading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Repaint ({imageSize})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Text & Reader Control Panel with story text and Narrator audio bar */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-white dark:bg-natural-bg rounded-[40px] border-[10px] border-white dark:border-natural-soft p-7 shadow-2xl relative min-h-[380px]">
          {/* Top text area with book styling */}
          <div className="space-y-5">
            <div className="flex justify-between items-center border-b border-natural-border pb-3">
              <span className="px-3 py-1 bg-natural-soft rounded-md text-[10px] font-bold uppercase tracking-wider text-natural-primary">
                Page {currentPage} of {pages.length}
              </span>
              
              {/* Font Size Affordance */}
              <div className="flex bg-natural-soft p-1 rounded-lg gap-1 border border-natural-border/60">
                {(["Small", "Medium", "Large"] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      fontSize === size ? "bg-white text-natural-primary shadow-sm" : "text-natural-muted hover:text-natural-dark"
                    }`}
                  >
                    {size === "Small" ? "A" : size === "Medium" ? "aA" : "Aa"}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive text section styled in high-class Georgia serif */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`${
                    fontSize === "Small" ? "text-base sm:text-lg md:text-xl" :
                    fontSize === "Medium" ? "text-lg sm:text-xl md:text-2xl" :
                    "text-xl sm:text-2xl md:text-3xl"
                  } font-serif text-natural-dark leading-relaxed italic flex flex-wrap`}
                  style={{ fontFamily: "'Georgia', serif, 'Times New Roman'" }}
                >
                  {(page.text || "").split(" ").map((word, wIdx) => (
                    <span 
                      key={wIdx} 
                      onClick={() => handleWordClick(word)}
                      className={`mr-[0.25em] transition-colors duration-150 cursor-pointer hover:text-natural-accent hover:border-b hover:border-natural-accent border-transparent border-b ${
                        highlightWordIdx === wIdx ? "text-natural-accent bg-natural-accent/10 rounded-lg px-0.5 -mx-0.5" : ""
                      }`}
                    >
                      {word}
                    </span>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Glossary Modal */}
            <AnimatePresence>
              {glossaryWord && (
                <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="absolute bg-white dark:bg-natural-soft top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl z-50 w-64 border-2 border-natural-border text-center"
                >
                   <button onClick={() => setGlossaryWord(null)} className="absolute right-3 top-3 text-natural-muted hover:text-natural-dark">✕</button>
                   <h3 className="font-bold text-2xl mb-1 text-natural-dark capitalize">{glossaryWord}</h3>
                   {glossaryLoading ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                         <Loader2 className="animate-spin text-natural-accent" size={24} />
                         <span className="text-xs text-natural-muted">Finding magic meaning...</span>
                      </div>
                   ) : glossaryDef ? (
                      <div>
                        {glossaryDef.img && <img src={glossaryDef.img} className="w-full h-32 object-cover rounded-2xl mb-3 shadow-inner" alt={`Illustration of ${glossaryWord}`} />}
                        <p className="text-sm font-semibold text-natural-dark">{glossaryDef.def}</p>
                      </div>
                   ) : (
                      <p className="text-sm text-natural-muted py-4">Couldn't find word art.</p>
                   )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show Educational Trivia if available */}
            {page.trivia && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-natural-soft/50 p-4 rounded-xl border border-natural-border flex items-start gap-3 mt-4"
              >
                <div className="w-8 h-8 rounded-full bg-natural-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-xl">💡</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-natural-accent uppercase tracking-wider mb-1">Did you know?</h4>
                  <p className="text-sm font-semibold text-natural-dark">{page.trivia}</p>
                </div>
              </motion.div>
            )}
            
            {/* Interactive Choices Area: Displayed only if we are at the end of generated pages but not final max pages */}
            {currentPage === pages.length && currentPage < story.targetPages && page.choices && page.choices.length > 0 && (
              <div className="pt-4 border-t border-natural-border/50 animate-fade-in">
                <p className="text-sm font-bold text-natural-muted mb-3 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-natural-accent" /> What happens next?
                </p>
                <div className="flex flex-col gap-2.5">
                  {page.choices.map((choice, cIdx) => (
                    <button
                      key={cIdx}
                      onClick={() => onContinue(choice.text)}
                      disabled={isContinuing || voiceLoading || playingPage !== null}
                      className="text-left bg-natural-soft hover:bg-natural-clay/60 border border-natural-border p-3.5 rounded-2xl text-[13px] font-bold text-natural-dark transition-all disabled:opacity-50 hover:border-natural-accent/50 flex justify-between items-center group cursor-pointer"
                    >
                      <span>{choice.text}</span>
                      <MoveRight size={16} className="text-natural-muted group-hover:text-natural-accent transform group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
                {isContinuing && (
                  <div className="flex items-center gap-2 text-natural-accent font-bold text-xs mt-3 bg-natural-soft p-2 rounded-xl">
                    <Loader2 size={14} className="animate-spin" /> Writing the next chapter...
                  </div>
                )}
              </div>
            )}
            
            {/* End of story marker */}
            {currentPage === story.targetPages && (
              <div className="pt-4 border-t border-natural-border/50 relative">
                <div className="absolute inset-0 pointer-events-none z-50 flex justify-around overflow-hidden h-32">
                   <div className="animate-leaf-fall text-natural-primary" style={{ animationDelay: '0s' }}><Leaf size={24} /></div>
                   <div className="animate-leaf-fall text-natural-accent" style={{ animationDelay: '0.2s' }}><Leaf size={20} /></div>
                   <div className="animate-leaf-fall text-natural-primary" style={{ animationDelay: '0.5s' }}><Leaf size={28} /></div>
                   <div className="animate-leaf-fall text-natural-accent" style={{ animationDelay: '0.1s' }}><Leaf size={22} /></div>
                   <div className="animate-leaf-fall text-natural-primary" style={{ animationDelay: '0.4s' }}><Leaf size={26} /></div>
                </div>
                <div className="bg-natural-primary/10 border border-natural-primary/20 p-4 rounded-2xl text-center relative z-10">
                  <h4 className="font-bold text-natural-primary mb-1">The End</h4>
                  <p className="text-xs font-semibold text-natural-muted">Hope you enjoyed the adventure!</p>
                </div>
              </div>
            )}
          </div>

          {/* Voice controller panel and custom natural audio visualizer blocks */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between bg-natural-soft/50 p-2 rounded-2xl border border-natural-border/50">
              <span className="text-xs font-bold text-natural-muted px-2 flex items-center gap-1.5">
                <Volume2 size={12} /> Speed:
              </span>
              <div className="flex gap-1">
                {[0.75, 1, 1.25].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setNarrationSpeed(speed)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      narrationSpeed === speed
                        ? "bg-natural-primary text-white shadow-sm"
                        : "text-natural-muted hover:bg-natural-clay/40"
                    }`}
                  >
                    {speed === 0.75 ? "Slower" : speed === 1 ? "Normal" : "Faster"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    if (playingPage === currentPage) {
                      if (audioCtx?.state === "running") {
                        audioCtx.suspend();
                      } else if (audioCtx?.state === "suspended") {
                        audioCtx.resume();
                      }
                    } else {
                      playAloud();
                    }
                  }}
                  className={`flex-1 py-3.5 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-sm transition-all ${
                    playingPage === currentPage
                      ? "bg-natural-accent hover:bg-natural-accent/90"
                      : "bg-natural-primary hover:bg-natural-primary/90"
                  }`}
                >
                  {voiceLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Focusing Voice...</span>
                    </>
                  ) : playingPage === currentPage && audioCtx?.state === "running" ? (
                    <>
                      <Square size={16} fill="white" />
                      <span>Pause</span>
                    </>
                  ) : playingPage === currentPage && audioCtx?.state === "suspended" ? (
                    <>
                      <Play size={16} fill="white" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={18} />
                      <span>Read Aloud</span>
                    </>
                  )}
                </motion.button>
                {playingPage === currentPage && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      stopAloud();
                      setTimeout(playAloud, 100);
                    }}
                    className="h-[52px] w-[52px] shrink-0 flex items-center justify-center bg-natural-soft text-natural-dark border border-natural-border rounded-xl hover:bg-natural-clay transition-colors"
                  >
                    <RotateCcw size={20} />
                  </motion.button>
                )}
              </div>

              {playingPage === currentPage && (
                <div className="flex flex-col gap-2 py-2 bg-natural-soft/50 rounded-xl border border-natural-border/40 px-3">
                  <div className="flex justify-between items-center w-full">
                    <span className="text-natural-primary text-xs font-bold animate-pulse">Narrator: Sounding Outdoors...</span>
                    <span className="text-natural-primary text-xs font-bold" id="narration-timer-text">--s</span>
                  </div>
                  <div className="w-full h-1.5 bg-natural-border rounded-full overflow-hidden">
                    <div id="narration-timer-progress" className="h-full bg-natural-primary" style={{ width: '0%' }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Back & Next Navigation Arrows with refined natural curves and progress bar */}
            <div className="pt-4 border-t border-natural-border">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => handlePageChange("prev")}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                    currentPage === 1
                      ? "text-natural-border border-natural-border/40 cursor-not-allowed"
                      : "text-natural-muted border-natural-border bg-white dark:bg-natural-soft hover:border-natural-accent hover:text-natural-accent"
                  }`}
                >
                  <ChevronLeft size={14} /> Back
                </button>

                <div className="text-xs font-bold text-natural-muted">
                  {currentPage} / {pages.length} leaves
                </div>

                <button
                  onClick={() => handlePageChange("next")}
                  disabled={currentPage === pages.length}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    currentPage === pages.length
                      ? "text-natural-border border-natural-border/30 cursor-not-allowed"
                      : "text-white bg-natural-accent hover:scale-[1.02]"
                  }`}
                >
                  Turn Page <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
