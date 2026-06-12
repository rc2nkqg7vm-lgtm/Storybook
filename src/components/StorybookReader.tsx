import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen, ChevronLeft, ChevronRight, Play, Square,
  RotateCcw, Sparkles, Image, RefreshCw, Volume2, ArrowLeft, Loader2, Leaf, MoveRight
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
  const playAnimationRef = useRef<number>();

  const { title, pages } = story;
  const page = pages[currentPage - 1];

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
      const duration = activeSource.buffer?.duration || 1;
      
      const updateHighlight = () => {
        if (!page) return;
        const elapsed = audioCtx.currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        const totalChars = page.text.length;
        const targetCharIdx = progress * totalChars;
        
        let charAcc = 0;
        let foundWordIdx = -1;
        const renderWords = page.text.split(" ");
        
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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-natural-border shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-4 py-2 bg-natural-soft hover:bg-natural-clay/50 text-natural-dark font-bold rounded-2xl border border-natural-border/60 text-xs sm:text-sm transition-all"
        >
          <ArrowLeft size={14} /> Close Book
        </button>

        <h3 className="text-base sm:text-lg font-serif font-bold text-natural-dark line-clamp-1 flex items-center gap-2">
          📖 {title}
        </h3>

        {/* Quality Size Controls: Direct requirement satisfying affordance */}
        <div className="flex items-center gap-1.5 bg-natural-soft/70 p-1 rounded-2xl border border-natural-border">
          <span className="text-xs font-bold text-natural-muted px-2 flex items-center gap-1">
            <Image size={11} /> Size:
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

      {/* Main Storybook Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Art Illustration Panel with gorgeous Natural Tones double border frame */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-[#EBE5D9] rounded-[48px] md:rounded-[56px] border-[8px] md:border-[12px] border-white aspect-[4/3] flex items-center justify-center relative overflow-hidden shadow-2xl min-h-[300px]">
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
            <div className="absolute bottom-4 left-4 bg-natural-dark/80 backdrop-blur-md text-white font-bold px-3.5 py-1.5 rounded-full text-xs">
              Page {currentPage} of {pages.length}
            </div>

            {/* Repaint Affordance beautifully matched to Natural Tones style */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
              <button
                onClick={() => paintIllustration(true)}
                title="Repaint page"
                disabled={imageLoading}
                className="bg-white/90 hover:bg-white text-natural-accent hover:text-natural-accent/80 backdrop-blur-md px-4 py-2 rounded-full text-xs font-extrabold transition-all flex items-center gap-2 shadow-sm border border-natural-border/60 disabled:opacity-50"
              >
                <RefreshCw size={13} className={imageLoading ? "animate-spin" : ""} />
                <span>Repaint ({imageSize})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Text & Reader Control Panel with story text and Narrator audio bar */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-[40px] border-[10px] border-white p-7 shadow-2xl relative min-h-[380px]">
          {/* Top text area with book styling */}
          <div className="space-y-5">
            <div className="flex justify-between items-center border-b border-natural-border pb-3">
              <span className="px-3 py-1 bg-natural-soft rounded-md text-[10px] font-bold uppercase tracking-wider text-natural-primary">
                Page {currentPage} of {pages.length}
              </span>
              <span className="text-sm">🌿</span>
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
                  className="text-lg sm:text-xl md:text-2xl font-serif text-natural-dark leading-relaxed italic flex flex-wrap"
                  style={{ fontFamily: "'Georgia', serif, 'Times New Roman'" }}
                >
                  {page.text.split(" ").map((word, wIdx) => (
                    <span 
                      key={wIdx} 
                      className={`mr-[0.25em] transition-colors duration-150 ${
                        highlightWordIdx === wIdx ? "text-natural-accent bg-natural-accent/10 rounded-lg px-0.5 -mx-0.5" : ""
                      }`}
                    >
                      {word}
                    </span>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
            
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
              <div className="pt-4 border-t border-natural-border/50">
                <div className="bg-natural-primary/10 border border-natural-primary/20 p-4 rounded-2xl text-center">
                  <h4 className="font-bold text-natural-primary mb-1">The End</h4>
                  <p className="text-xs font-semibold text-natural-muted">Hope you enjoyed the adventure!</p>
                </div>
              </div>
            )}
          </div>

          {/* Voice controller panel and custom natural audio visualizer blocks */}
          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-2.5">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={playAloud}
                className={`w-full py-3.5 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-sm transition-all ${
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
                ) : playingPage === currentPage ? (
                  <>
                    <Square size={16} fill="white" />
                    <span>Stop Narrator</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={18} />
                    <span>Read Aloud</span>
                  </>
                )}
              </motion.button>

              {playingPage === currentPage && (
                <div className="flex justify-center items-center gap-2 py-1 bg-natural-soft/50 rounded-xl border border-natural-border/40">
                  <span className="text-natural-primary text-xs font-bold animate-pulse">Narrator: Sounding Outdoors...</span>
                  <div className="flex gap-0.5 items-end h-3">
                    <div className="w-1 h-3 bg-natural-primary rounded-full animate-bounce"></div>
                    <div className="w-1 h-5 bg-natural-primary rounded-full animate-bounce delay-100"></div>
                    <div className="w-1 h-4 bg-natural-primary rounded-full animate-bounce delay-200"></div>
                    <div className="w-1 h-6 bg-natural-primary rounded-full animate-bounce delay-75"></div>
                    <div className="w-1 h-2 bg-natural-primary rounded-full animate-bounce delay-150"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Back & Next Navigation Arrows with refined natural curves and progress bar */}
            <div className="pt-4 border-t border-natural-border">
              {/* Natural slider progress */}
              <div className="h-2 bg-natural-soft rounded-full overflow-hidden mb-5">
                <div 
                  className="h-full bg-natural-primary rounded-full transition-all duration-300" 
                  style={{ width: `${(currentPage / pages.length) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => handlePageChange("prev")}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${
                    currentPage === 1
                      ? "text-natural-border border-natural-border/40 cursor-not-allowed"
                      : "text-natural-muted border-natural-border bg-white hover:border-natural-accent hover:text-natural-accent"
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
