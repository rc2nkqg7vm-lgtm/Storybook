export interface StoryChoice {
  text: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  choices?: StoryChoice[];
}

export interface Storybook {
  title: string;
  theme: string;
  character: string;
  setting: string;
  customPrompt?: string;
  targetPages: number;
  pages: StoryPage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

export interface Companion {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  color: string;
  sound: string;
}

export type ImageSize = "1K" | "2K" | "4K";

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  description: string;
}
