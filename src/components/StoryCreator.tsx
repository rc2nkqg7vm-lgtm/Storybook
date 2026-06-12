import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Wand2, ArrowRight, User, Compass, MapPin, Volume2, Image, Smile, Lightbulb, Sprout, Mic, MicOff } from "lucide-react";
import { ImageSize, VoiceOption } from "../types";

interface StoryCreatorProps {
  onGenerate: (config: {
    theme: string;
    character: string;
    setting: string;
    customPrompt: string;
    numPages: number;
    voice: string;
    imageSize: ImageSize;
    mood: string;
    educationalMode: boolean;
  }) => void;
  isLoading: boolean;
  prefillCharacter?: string;
}

const CHARACTERS = [
  { label: "🦊 Clever Little Fox", value: "a clever little orange fox wearing a tiny green cape" },
  { label: "🦖 Friendly Baby Dino", value: "a friendly baby tyrannosaurus who loves baking pancakes" },
  { label: "🤖 Clockwork Little Robot", value: "a sweet little clockwork toy robot with glowing brass gears" },
  { label: "🐳 Bubbly Pink Whale", value: "a bright, joyful bubbly pink whale with starry eyes" },
];

const THEMES = [
  { label: "🌟 Finding a Lost Star", value: "finding a fallen star and returning it to the nighttime sky" },
  { label: "🌳 Finding a Treehouse", value: "discovering a magical hidden treehouse that floats gently" },
  { label: "🍪 Giant Cookie Picnic", value: "sharing a super tall stack of freshly baked chocolate cookies" },
  { label: "🛸 Saturn Star-Sailing", value: "sailing on a sailboat made of stardust around the ring of Saturn" },
];

const SETTINGS = [
  { label: "🍭 Candy Dream Island", value: "the Candy Dream Island made of marshmallow hills and lemonade lakes" },
  { label: "🌲 Whispering Green Woods", value: "the Whispering Green Woods where trees sing soft gentle lullabies" },
  { label: "☁️ City in the Clouds", value: "the Floating Cloud Castle where you can bounce on fluffy steam puffs" },
  { label: "🐚 Deep Coral Gardens", value: "the Glowing Coral Gardens of the Undersea Octopus Village" },
];

const MOODS = [
  { label: "😊 Happy & Joyful", value: "Happy and Joyful" },
  { label: "🗺️ Adventurous & Bold", value: "Adventurous and Bold" },
  { label: "👻 Slightly Spooky & Silly", value: "Slightly Spooky but Silly" },
  { label: "🌙 Calming & Sleepy", value: "Calming and Sleepy for Bedtime" },
];

const VOICES: VoiceOption[] = [
  { id: "Kore", name: "Kore (Friendly Storyteller)", gender: "Female", description: "Warm, gentle and delightful." },
  { id: "Puck", name: "Puck (Playful Fairy)", gender: "Female", description: "Cheerful, lively and spirited." },
  { id: "Zephyr", name: "Zephyr (Calming Breeze)", gender: "Neutral", description: "Soft, smooth and relaxing." },
  { id: "Fenrir", name: "Fenrir (Adventure Guide)", gender: "Male", description: "Strong, brave and heroic." },
  { id: "Charon", name: "Charon (Wise Elder)", gender: "Male", description: "Deep, calm and storytelling master." }
];

const IMAGE_SIZES: { value: ImageSize; label: string; desc: string }[] = [
  { value: "1K", label: "🎨 Standard (1K)", desc: "Quick paint! Joyful cartoon details" },
  { value: "2K", label: "✨ High Detail (2K)", desc: "Super sharp! Hand-painted children's textures" },
  { value: "4K", label: "🌟 Ultra Detail (4K)", desc: "Magical canvas quality! Intricate story textures" }
];

export default function StoryCreator({ onGenerate, isLoading, prefillCharacter }: StoryCreatorProps) {
  const [character, setCharacter] = useState(prefillCharacter ? "custom" : "");
  const [customCharacter, setCustomCharacter] = useState(prefillCharacter || "");
  const [theme, setTheme] = useState("");
  const [customTheme, setCustomTheme] = useState("");
  const [setting, setSetting] = useState("");
  const [customSetting, setCustomSetting] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [numPages, setNumPages] = useState<number>(4);
  const [voice, setVoice] = useState("Kore");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [mood, setMood] = useState(MOODS[0].value);
  const [educationalMode, setEducationalMode] = useState(false);

  const [customCharActive, setCustomCharActive] = useState(!!prefillCharacter);
  const [customThemeActive, setCustomThemeActive] = useState(false);
  const [customSettingActive, setCustomSettingActive] = useState(false);

  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in (window as any)) && !('SpeechRecognition' in (window as any))) {
      alert("Oops! Your browser doesn't support our magic voice writing. Try typing instead!");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
         setCustomPrompt((prev) => prev ? prev + ' ' + finalTranscript : finalTranscript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const thinkingMessages = [
    "Sowing story seeds...",
    "Nurturing the characters...",
    "Watering the imagination...",
    "Fostering the setting...",
    "Growing the narrative...",
    "Almost ready to blossom..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setThinkingIndex(0);
      interval = setInterval(() => {
        setThinkingIndex((prev) => (prev + 1) % thinkingMessages.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCharacter = customCharActive ? customCharacter : character;
    const finalTheme = customThemeActive ? customTheme : theme;
    const finalSetting = customSettingActive ? customSetting : setting;

    if (!finalCharacter || !finalTheme || !finalSetting) {
      alert("Oops! Please select or write a character, theme, and setting first!");
      return;
    }

    onGenerate({
      character: finalCharacter,
      theme: finalTheme,
      setting: finalSetting,
      customPrompt,
      numPages,
      voice,
      imageSize,
      mood,
      educationalMode
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white/90 dark:bg-natural-bg/90 backdrop-blur-md rounded-[48px] border-[10px] border-white dark:border-natural-soft p-8 shadow-2xl relative overflow-hidden"
    >
      {/* Decorative background stamps */}
      <div className="absolute top-2 right-2 opacity-10 pointer-events-none text-natural-primary">
        <Sparkles size={120} className="animate-pulse" />
      </div>

      <div className="text-center mb-8">
        <span className="bg-natural-soft text-natural-primary text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest inline-flex items-center gap-1.5 border border-natural-border">
          <Wand2 size={14} /> Magical Craft Studio
        </span>
        <h2 className="text-3xl sm:text-4xl mt-3 font-serif font-bold text-natural-dark tracking-tight">
          Create Your Storybook
        </h2>
        <p className="text-natural-muted mt-2 font-medium max-w-lg mx-auto text-sm">
          Select or write some whimsical ideas below, and our creative forest sprites will plant, nurture, and design your brand-new book!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8" id="storybook-creation-form">
        {/* CHARACTER SECTION */}
        <div className="space-y-4">
          <label className="text-base font-bold text-natural-dark flex items-center gap-2">
            <span className="p-1.5 bg-natural-soft text-natural-primary rounded-xl border border-natural-border"><User size={16} /></span>
            1. Who is our Main Character?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHARACTERS.map((char) => (
              <button
                key={char.label}
                type="button"
                onClick={() => {
                  setCharacter(char.value);
                  setCustomCharActive(false);
                }}
                className={`py-3.5 px-5 rounded-2xl text-left font-medium border-2 text-sm transition-all flex items-center justify-between ${
                  !customCharActive && character === char.value
                    ? "border-natural-primary bg-natural-soft text-natural-dark shadow-sm scale-[1.01]"
                    : "border-natural-border/40 bg-natural-bg/50 text-natural-muted hover:border-natural-primary/50 hover:bg-natural-soft/40"
                }`}
              >
                <span>{char.label}</span>
              </button>
            ))}
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCustomCharActive(true)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all mr-2 border ${
                customCharActive
                  ? "bg-natural-primary text-white border-natural-primary shadow"
                  : "bg-natural-soft text-natural-muted border-natural-border hover:bg-natural-clay"
              }`}
            >
              ✍️ Write My Own Custom Character
            </button>
            {customCharActive && (
              <motion.input
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                type="text"
                value={customCharacter}
                onChange={(e) => setCustomCharacter(e.target.value)}
                placeholder="Type a character e.g., a tiny baby elephant with fluffy blue ears..."
                className="w-full mt-3 p-3 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-xl focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark text-sm"
                required={customCharActive}
              />
            )}
          </div>
        </div>

        {/* THEME/QUEST SECTION */}
        <div className="space-y-4">
          <label className="text-base font-bold text-natural-dark flex items-center gap-2">
            <span className="p-1.5 bg-natural-soft text-natural-primary rounded-xl border border-natural-border"><Compass size={16} /></span>
            2. What is the Story Quest or Theme?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTheme(t.value);
                  setCustomThemeActive(false);
                }}
                className={`py-3.5 px-5 rounded-2xl text-left font-medium border-2 text-sm transition-all flex items-center justify-between ${
                  !customThemeActive && theme === t.value
                    ? "border-natural-primary bg-natural-soft text-natural-dark shadow-sm scale-[1.01]"
                    : "border-natural-border/40 bg-natural-bg/50 text-natural-muted hover:border-natural-primary/50 hover:bg-natural-soft/40"
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCustomThemeActive(true)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all mr-2 border ${
                customThemeActive
                  ? "bg-natural-primary text-white border-natural-primary shadow"
                  : "bg-natural-soft text-natural-muted border-natural-border hover:bg-natural-clay"
              }`}
            >
              ✍️ Write My Own Custom Quest
            </button>
            {customThemeActive && (
              <motion.input
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                type="text"
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                placeholder="Type a theme e.g., learning how to make the birds whistle a happy tune..."
                className="w-full mt-3 p-3 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-xl focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark text-sm"
                required={customThemeActive}
              />
            )}
          </div>
        </div>

        {/* SETTING SECTION */}
        <div className="space-y-4">
          <label className="text-base font-bold text-natural-dark flex items-center gap-2">
            <span className="p-1.5 bg-natural-soft text-natural-primary rounded-xl border border-natural-border"><MapPin size={16} /></span>
            3. Where does the story take place?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SETTINGS.map((set) => (
              <button
                key={set.label}
                type="button"
                onClick={() => {
                  setSetting(set.value);
                  setCustomSettingActive(false);
                }}
                className={`py-3.5 px-5 rounded-2xl text-left font-medium border-2 text-sm transition-all flex items-center justify-between ${
                  !customSettingActive && setting === set.value
                    ? "border-natural-primary bg-natural-soft text-natural-dark shadow-sm scale-[1.01]"
                    : "border-natural-border/40 bg-natural-bg/50 text-natural-muted hover:border-natural-primary/50 hover:bg-natural-soft/40"
                }`}
              >
                <span>{set.label}</span>
              </button>
            ))}
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCustomSettingActive(true)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all mr-2 border ${
                customSettingActive
                  ? "bg-natural-primary text-white border-natural-primary shadow"
                  : "bg-natural-soft text-natural-muted border-natural-border hover:bg-natural-clay"
              }`}
            >
              ✍️ Write My Own Custom Setting
            </button>
            {customSettingActive && (
              <motion.input
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                type="text"
                value={customSetting}
                onChange={(e) => setCustomSetting(e.target.value)}
                placeholder="Type a location e.g., a sparkling cave of glittering pink sugar crystals..."
                className="w-full mt-3 p-3 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-xl focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark text-sm"
                required={customSettingActive}
              />
            )}
          </div>
        </div>

        {/* COMPLETELY CUSTOM PROMPT (EXTRAS) */}
        <div className="space-y-4 pt-4 border-t-2 border-natural-border">
            <label className="text-base font-bold text-natural-dark flex items-center gap-2">
              <span className="p-1.5 bg-natural-soft text-natural-primary rounded-xl border border-natural-border"><Sparkles size={16} /></span>
              Optional: Any extra details or magical twists?
            </label>
            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. Include a secret hidden door, make it rhyming, add a wise old owl friend..."
                className="w-full p-4 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-xl focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark text-sm min-h-[100px] resize-y shadow-sm"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-3 top-3 p-2 rounded-full transition-colors hidden sm:flex ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-natural-soft text-natural-muted hover:text-natural-primary'}`}
                title="Dictate your prompt"
              >
                 {isListening ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
            </div>
            <div className="flex items-center gap-3 bg-natural-soft/50 p-3 rounded-xl border border-natural-border/50 w-max">
              <input
                type="checkbox"
                id="eduMode"
                checked={educationalMode}
                onChange={(e) => setEducationalMode(e.target.checked)}
                className="w-5 h-5 rounded text-natural-primary focus:ring-natural-primary border-natural-border"
              />
              <label htmlFor="eduMode" className="text-sm font-bold text-natural-dark flex items-center gap-1.5 cursor-pointer select-none">
                <Lightbulb size={16} className="text-amber-500" />
                Educational Mode (Add fun facts to pages)
              </label>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t-2 border-natural-border">
          {/* MOOD SELECTION */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-natural-dark flex items-center gap-1.5">
              <Smile className="text-natural-primary" size={16} />
              Story Mood & Tone
            </label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full p-3 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-2xl text-sm font-bold focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark cursor-pointer shadow-sm"
            >
              {MOODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* NARRATOR VOICE */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-natural-dark flex items-center gap-1.5">
              <Volume2 className="text-natural-primary" size={16} />
              Choose Narrator Whisperer
            </label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full p-3 border-2 border-natural-border bg-white dark:bg-natural-soft rounded-2xl text-sm font-bold focus:border-natural-primary focus:ring-0 focus:outline-none text-natural-dark cursor-pointer shadow-sm"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} - {v.description}
                </option>
              ))}
            </select>
          </div>

          {/* IMAGE SIZE SELECTION */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-natural-dark flex items-center gap-1.5">
              <Image className="text-natural-primary" size={16} />
              Painting Sheet Quality (Size)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {IMAGE_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setImageSize(size.value)}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    imageSize === size.value
                      ? "bg-natural-primary border-natural-primary text-white font-bold scale-[1.02] shadow-sm"
                      : "border-natural-border/60 bg-white dark:bg-natural-soft text-natural-muted font-bold text-xs hover:bg-natural-soft dark:hover:bg-natural-clay"
                  }`}
                  title={size.desc}
                >
                  <div className="text-xs sm:text-sm">{size.value}</div>
                  <div className="text-[9px] font-normal opacity-90 leading-tight hidden sm:block mt-0.5">
                    {size.value === "1K" ? "Sprout Speed" : size.value === "2K" ? "Lush Ink" : "Deep Canvas"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PAGES LENGTH */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-6 border-t-2 border-natural-border">
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-natural-dark">Storybook Pages</h4>
            <p className="text-xs text-natural-muted">How deep should our exploration go?</p>
          </div>
          <div className="flex gap-1 bg-natural-soft rounded-2xl p-1.5 border border-natural-border">
            {[3, 4, 5, 6].map((pNum) => (
              <button
                key={pNum}
                type="button"
                onClick={() => setNumPages(pNum)}
                className={`w-11 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all ${
                  numPages === pNum
                    ? "bg-natural-primary text-white shadow-sm scale-105"
                    : "text-natural-muted hover:bg-natural-clay/60"
                }`}
              >
                {pNum} leaves
              </button>
            ))}
          </div>
        </div>

        {/* LAUNCH STORYBOOK */}
        <div className={`pt-4 ${isLoading ? 'animate-pulse' : ''}`}>
          <motion.button
            whileHover={{ scale: isLoading ? 1 : 1.01 }}
            whileTap={{ scale: isLoading ? 1 : 0.99 }}
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 text-white font-extrabold text-lg rounded-3xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-natural-primary/25 overflow-hidden ${
              isLoading
                ? "bg-natural-primary cursor-not-allowed border-b-4 border-natural-primary"
                : "bg-natural-accent hover:bg-[#C47A5A] border-b-4 border-[#A35D43]"
            }`}
          >
            {isLoading ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={thinkingIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2"
                >
                  <Sprout className="animate-bounce" size={20} />
                  <span>{thinkingMessages[thinkingIndex]}</span>
                </motion.div>
              </AnimatePresence>
            ) : (
              <>
                <ArrowRight size={20} />
                <span>Nurture & Plant Your Story!</span>
              </>
            )}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

