import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up bodies with higher limit for image generation purposes
app.use(express.json({ limit: "50mb" }));

// Lazy initializer for Google GenAI client to prevent startup crash if API key is blank
let aiInstance: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required in secrets");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiInstance;
}

// Generate wrapper with retry logic for 503 errors
async function generateWithRetry(ai: GoogleGenAI, request: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err: any) {
      const isUnavailable = err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && (err.message.includes('503') || err.message.includes('UNAVAILABLE')));
      if (isUnavailable && i < maxRetries - 1) {
        console.warn(`Model unavailable, retrying in ${Math.pow(2, i)}s...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      } else {
        throw err;
      }
    }
  }
}

// 1. API: Storybook Creation (Interactive Start)
app.post("/api/story/start", async (req, res) => {
  try {
    const { theme, character, setting, customPrompt, numPages = 4, language = "English", mood, educationalMode } = req.body;
    if (!theme || !character || !setting) {
      return res.status(400).json({ error: "Please enter theme, character, and setting!" });
    }

    const ai = getAi();
    const prompt = `Write the introduction (Page 1) of a charming, whimsical child storybook in ${language}.
Theme: ${theme}
Character: ${character}
Setting: ${setting}
${mood ? `Mood/Tone: ${mood}\n` : ""}
${customPrompt ? `Custom Idea: "${customPrompt}"\n` : ""}
This is Page 1 of a planned ${numPages}-page story.
Write 1 to 3 delightful sentences appropriate for kids aged 3-8.
At the end of the page, provide 2 to 3 "choices" for the reader to decide what the character should do next.
Also provide a highly descriptive "imagePrompt" (e.g. "a vivid children's book illustration, watercolor style...") with no text in the image.
${educationalMode ? `Since Educational Mode is ON, provide a short, fun piece of trivia (1 sentence) related to the current setting, theme, or events on this page in the 'trivia' field.` : ""}`;

    const properties: any = {
      pageNumber: { type: Type.INTEGER },
      text: { type: Type.STRING, description: "1 to 3 short sentences written beautifully for children." },
      imagePrompt: { type: Type.STRING, description: "Highly descriptive illustration prompt." },
      choices: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING } }
        }
      }
    };

    if (educationalMode) {
      properties.trivia = { type: Type.STRING, description: "A simple, fun, educational fact related to the page content." };
    }

    const requiredFields = ["pageNumber", "text", "imagePrompt", "choices"];

    const response = await generateWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an award-winning children's interactive story author.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             title: { type: Type.STRING, description: "The beautiful title of the storybook" },
             page: {
               type: Type.OBJECT,
               properties: properties,
               required: requiredFields
             }
          },
          required: ["title", "page"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("Empty response received");

    const data = JSON.parse(textOutput);
    res.json({
      title: data.title,
      targetPages: numPages,
      pages: [data.page]
    });
  } catch (err: any) {
    console.error("Story start error:", err);
    let msg = err.message || "Could not start your story.";
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
      msg = "The storyteller is taking a quick break! We are experiencing high demand right now. Please wait a few seconds and try again.";
    }
    res.status(500).json({ error: msg });
  }
});

// 1.5 API: Storybook Creation (Interactive Continue)
app.post("/api/story/continue", async (req, res) => {
  try {
    const { title, previousPages, choice, nextPageNum, targetPages, language = "English", mood, educationalMode } = req.body;
    
    const isLastPage = nextPageNum >= targetPages;
    const historyText = previousPages.map((p: any) => `Page ${p.pageNumber}: ${p.text}`).join("\n");

    const ai = getAi();
    const prompt = `We are writing an interactive children's story titled "${title}" in ${language}.
Story so far:
${historyText}

The reader chose: "${choice}".
Write Page ${nextPageNum}.
${mood ? `Maintain the Mood/Tone: ${mood}\n` : ""}
${isLastPage ? "This is the final page. Conclude the story beautifully. Do NOT provide choices." : "Provide 2-3 choices for what happens next."}
Write 1 to 3 delightful sentences appropriate for kids aged 3-8.
Also provide a highly descriptive "imagePrompt" matching the visual style of the story (e.g. "a vivid children's book illustration, watercolor style..."). No text in the image.
${educationalMode ? `Since Educational Mode is ON, provide a short, fun piece of trivia (1 sentence) related to the current setting, theme, or events on this page in the 'trivia' field.` : ""}`;

    const properties: any = {
      pageNumber: { type: Type.INTEGER },
      text: { type: Type.STRING },
      imagePrompt: { type: Type.STRING }
    };

    const requiredFields = ["pageNumber", "text", "imagePrompt"];

    if (!isLastPage) {
      properties.choices = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { text: { type: Type.STRING } }
        }
      };
    }

    if (educationalMode) {
      properties.trivia = { type: Type.STRING, description: "A simple, fun, educational fact related to the page content." };
    }

    const response = await generateWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an award-winning children's interactive story author.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             page: {
               type: Type.OBJECT,
               properties: properties,
               required: requiredFields
             }
          },
          required: ["page"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("Empty response received");

    const data = JSON.parse(textOutput);
    res.json(data);
  } catch (err: any) {
    console.error("Story continue error:", err);
    let msg = err.message || "Could not continue your story.";
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
       msg = "The storyteller is resting just a moment! We are experiencing high demand right now. Please wait a few seconds and try again.";
    }
    res.status(500).json({ error: msg });
  }
});

// 2. API: Text-to-Speech (Aloud)
app.post("/api/story/tts", async (req, res) => {
  try {
    const { text, voice = "Kore" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided to read." });
    }

    const ai = getAi();
    // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const response = await generateWithRetry(ai, {
      model: "gemini-3.1-flash-tts-preview", // Specified model
      contents: [{ parts: [{ text: `Read cheerfully: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: "Failed to generate storybook voice track." });
    }

    res.json({ base64Audio });
  } catch (err: any) {
    console.error("TTS generation error:", err);
    res.status(500).json({ error: err.message || "Voice reader is sleeping right now." });
  }
});

// 3. API: Illustration Generation (Painting)
app.post("/api/story/illustration", async (req, res) => {
  try {
    const { imagePrompt, imageSize = "1K" } = req.body;
    if (!imagePrompt) {
      return res.status(400).json({ error: "No illustration description provided." });
    }

    const ai = getAi();
    const response = await generateWithRetry(ai, {
      model: "gemini-3.1-flash-image", // Changed to correct model
      contents: {
        parts: [{ text: imagePrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3", // Great landscape ratio for kids' books
          imageSize: imageSize // 1K, 2K, 4K
        }
      }
    });

    let base64Image = null;
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      return res.status(500).json({ error: "No image bytes could be created by the painter model." });
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (err: any) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: err.message || "Failed to trigger the painting wand." });
  }
});

// 4. API: Kids Storybook Chat Companion
app.post("/api/story/chat", async (req, res) => {
  try {
    const { history, companionId, userMessage, currentStoryContext, askSuperBrain = false } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: "Message is empty." });
    }

    let systemInstruction = "";
    let modelName = "gemini-3.5-flash"; // general task model

    // Configure role instruction and model selection based on character
    if (companionId === "wise_owl") {
      systemInstruction = "You are Barnaby, a very gentle and wise old reading helper owl perched on a cozy branch. You love helping children understand words, morals, and magical ideas. Ask warm questions and define tricky words simply! Keep responses under 3 short sentences so kids don't feel overwhelmed. Use a hooting emoji 🦉.";
      modelName = "gemini-3.5-flash"; // general task
    } else if (companionId === "silly_dragon") {
      systemInstruction = "You are Sparky, a silly, hyperactive baby dragon who is crazy about reading and eating pancakes! You speak with happy tail wags, adorable snorts (*giggle*, *puff of smoke!*), and cute emojis. Cheer the child on, get incredibly excited about the story, and keep things highly engaging. Restrict responses to 2 fun sentences.";
      modelName = "gemini-3.5-flash"; // general task
    } else if (companionId === "magic_spark") {
      systemInstruction = "You are Pippin, a sparkly lightning-fast starry pixie residing inside the book. You answer everything with magical dust and lightning speed! Write very brief (under 15 words) and extremely bubbly, upbeat answers with lots of sparkle emojis (✨). Be extremely snappy!";
      modelName = "gemini-3.5-flash"; // for tasks that should happen fast
    } else {
      systemInstruction = "You are a friendly, encouraging story companion for kids. Answer in a warm, child-safe, engaging way.";
      modelName = "gemini-3.5-flash";
    }

    // "Use gemini-3.1-pro-preview for particularly complex tasks"
    if (askSuperBrain) {
      modelName = "gemini-3.1-pro-preview";
      systemInstruction += " Since this is a particularly complex task, think extra deeply to simplify the explanation of this difficult topic using creative children's analogies, magical comparisons, and gentle words.";
    }

    const formattedContents: any[] = [];

    // Inject story theme / context to guide the conversation
    if (currentStoryContext) {
      formattedContents.push({
        role: "user",
        parts: [{ text: `[System Context: We are reading a storybook titled "${currentStoryContext.title}". Here are the pages: ${JSON.stringify(currentStoryContext.pages)}. Help me discuss these characters or answer my questions based on this story context!]` }]
      });
      formattedContents.push({
        role: "model",
        parts: [{ text: `Oh! I love the story "${currentStoryContext.title}"! Let's read and chat about it together!` }]
      });
    }

    // Map history to proper contents array
    if (history && Array.isArray(history)) {
      for (const turn of history) {
        formattedContents.push({
          role: turn.role === "user" ? "user" : "model",
          parts: [{ text: turn.text }]
        });
      }
    }

    // Append the final user message
    formattedContents.push({
      role: "user",
      parts: [{ text: userMessage }]
    });

    const ai = getAi();
    const result = await generateWithRetry(ai, {
      model: modelName,
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.85
      }
    });

    res.json({ text: result.text || "I was dreaming about cozy nests and missed that! Can you say it again?" });
  } catch (err: any) {
    console.error("Chat companion error:", err);
    res.status(500).json({ error: err.message || "The companion is currently taking a little nap. Try again!" });
  }
});

// 5. API: Story Glossary
app.post("/api/story/glossary", async (req, res) => {
  try {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "No word provided." });

    const ai = getAi();
    const prompt = `Define the tricky word "${word}" simply and playfully for a child aged 3-8 in 1 short sentence.
Then, create an "imagePrompt" to beautifully illustrate this concept in a children's book style.`;
    
    const defResponse = await generateWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
             definition: { type: Type.STRING },
             imagePrompt: { type: Type.STRING }
          },
          required: ["definition", "imagePrompt"]
        }
      }
    });

    if (!defResponse.text) throw new Error("Empty response");
    const data = JSON.parse(defResponse.text);

    let base64Image = null;
    try {
      const imgResponse = await generateWithRetry(ai, {
        model: "gemini-3.1-flash-image",
        contents: { parts: [{ text: data.imagePrompt }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });
      const parts = imgResponse.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }
    } catch (e) {
      console.error("Glossary image fallback to text only", e);
    }

    res.json({
      word,
      definition: data.definition,
      imageUrl: base64Image ? `data:image/png;base64,${base64Image}` : null
    });
  } catch (err: any) {
    console.error("Glossary error:", err);
    res.status(500).json({ error: "Could not fetch dictionary right now." });
  }
});

// Vite Middleware & SPA Fallback setup
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Storybook server] Online and running in ${process.env.NODE_ENV || "dev"} mode on http://localhost:${PORT}`);
  });
}

setupServer();
