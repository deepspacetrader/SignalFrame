import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));

const LM_STUDIO_URL = "http://localhost:1234/api/v1/chat";
const PORT = 3322;

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Image Prompt Enhancement Endpoint
app.post("/api/enhance-image-prompt", async (req, res) => {
  try {
    const { prompt, model, provider, baseUrl } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!model) {
      return res.status(400).json({ error: "Model is required. Please configure an AI model in AI Settings." });
    }
    if (!provider) {
      return res.status(400).json({ error: "Provider is required. Please configure an AI provider in AI Settings." });
    }
    if (!baseUrl) {
      return res.status(400).json({ error: "Base URL is required. Please configure an AI provider in AI Settings." });
    }

    console.log(`Enhancing prompt: "${prompt}" via ${provider} with model: ${model}...`);

    // Construct full URL based on provider
    const fullUrl = provider === 'ollama' 
      ? `${baseUrl}/chat`
      : `${baseUrl}/api/v1/chat`;

    const payload = {
      model: model,
      system_prompt: "You are an expert at crafting detailed, realistic prompts for AI image generation models like SDXL. Your task is to take a simple user input and transform it into a rich, visually descriptive prompt that will produce photorealistic images grounded in reality. CRITICAL CONSTRAINTS: 1) NO sci-fi, fantasy, supernatural, or futuristic elements - stay strictly within realistic, contemporary settings 2) NO magical or impossible physics 3) NO alien, cybernetic, or synthetic elements 4) Focus on realistic details: natural lighting, authentic textures, real-world materials, believable compositions 5) Describe actual objects, people, places, or scenes that could exist in the real world 6) Keep the enhanced prompt concise (1-2 sentences) but packed with realistic visual information. Output ONLY the enhanced prompt, no explanations or extra text.",
      input: `Transform this simple concept into a realistic image generation prompt: "${prompt}"`
    };

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(err => {
      console.error("Connection to AI provider failed:", err.message);
      throw new Error(`Connection to ${provider} failed at ${fullUrl}. Is the AI service running?`);
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LM Studio returned an error:", errorText);
      throw new Error(`LM Studio error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();

    let extractedContent = "";

    // Handle LM Studio's specific format with output array
    if (data.output && Array.isArray(data.output)) {
      const messageObj = data.output.find((item: any) => item.type === 'message');
      extractedContent = messageObj?.content || data.output[data.output.length - 1]?.content || JSON.stringify(data.output);
    }
    // Handle stringified JSON
    else if (typeof data === 'string') {
      try {
        const parsedData = JSON.parse(data);
        if (Array.isArray(parsedData)) {
          const messageObj = parsedData.find((item: any) => item.type === 'message');
          extractedContent = messageObj?.content || parsedData[parsedData.length - 1]?.content || JSON.stringify(parsedData);
        } else {
          extractedContent = data;
        }
      } catch {
        extractedContent = data;
      }
    }
    // Handle direct array format
    else if (Array.isArray(data)) {
      const messageObj = data.find((item: any) => item.type === 'message');
      extractedContent = messageObj?.content || data[data.length - 1]?.content || JSON.stringify(data);
    }
    // Handle other formats
    else if (data.output) {
      extractedContent = typeof data.output === 'object' ? (data.output.content || JSON.stringify(data.output)) : data.output;
    } else if (data.content) {
      extractedContent = typeof data.content === 'object' ? (data.content.content || JSON.stringify(data.content)) : data.content;
    } else if (data.choices?.[0]?.message?.content) {
      extractedContent = data.choices[0].message.content;
    } else if (typeof data === 'string') {
      extractedContent = data;
    } else {
      extractedContent = "Unexpected response format from AI.";
    }

    res.json({ enhancedPrompt: extractedContent.trim() });
  } catch (error: any) {
    console.error("Prompt Enhancement Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Audio Prompt Enhancement Endpoint
app.post("/api/enhance-audio-prompt", async (req, res) => {
  try {
    const { prompt, model, provider, baseUrl } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!model) {
      return res.status(400).json({ error: "Model is required. Please configure an AI model in AI Settings." });
    }
    if (!provider) {
      return res.status(400).json({ error: "Provider is required. Please configure an AI provider in AI Settings." });
    }
    if (!baseUrl) {
      return res.status(400).json({ error: "Base URL is required. Please configure an AI provider in AI Settings." });
    }

    console.log(`Enhancing audio prompt: "${prompt}" via ${provider} with model: ${model}...`);

    // Construct full URL based on provider
    const fullUrl = provider === 'ollama' 
      ? `${baseUrl}/chat`
      : `${baseUrl}/api/v1/chat`;

    const payload = {
      model: model,
      system_prompt: "You are an expert at crafting detailed, evocative prompts for AI audio generation models. Your task is to take a simple user input and transform it into a rich, descriptive prompt that will produce high-quality audio or sound effects. Focus on: 1) Describing the sound characteristics (timbre, texture, dynamics), 2) Including spatial and temporal qualities (reverb, decay, attack), 3) Suggesting atmospheric or environmental context, 4) Describing emotional or mood qualities. Keep the enhanced prompt concise (1-2 sentences) but packed with auditory information. Output ONLY the enhanced prompt, no explanations or extra text.",
      input: `Transform this simple concept into a detailed audio generation prompt: "${prompt}"`
    };

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(err => {
      console.error("Connection to AI provider failed:", err.message);
      throw new Error(`Connection to ${provider} failed at ${fullUrl}. Is the AI service running?`);
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LM Studio returned an error:", errorText);
      throw new Error(`LM Studio error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();

    let extractedContent = "";

    // Handle LM Studio's specific format with output array
    if (data.output && Array.isArray(data.output)) {
      const messageObj = data.output.find((item: any) => item.type === 'message');
      extractedContent = messageObj?.content || data.output[data.output.length - 1]?.content || JSON.stringify(data.output);
    }
    // Handle stringified JSON
    else if (typeof data === 'string') {
      try {
        const parsedData = JSON.parse(data);
        if (Array.isArray(parsedData)) {
          const messageObj = parsedData.find((item: any) => item.type === 'message');
          extractedContent = messageObj?.content || parsedData[parsedData.length - 1]?.content || JSON.stringify(parsedData);
        } else {
          extractedContent = data;
        }
      } catch {
        extractedContent = data;
      }
    }
    // Handle direct array format
    else if (Array.isArray(data)) {
      const messageObj = data.find((item: any) => item.type === 'message');
      extractedContent = messageObj?.content || data[data.length - 1]?.content || JSON.stringify(data);
    }
    // Handle other formats
    else if (data.output) {
      extractedContent = typeof data.output === 'object' ? (data.output.content || JSON.stringify(data.output)) : data.output;
    } else if (data.content) {
      extractedContent = typeof data.content === 'object' ? (data.content.content || JSON.stringify(data.content)) : data.content;
    } else if (data.choices?.[0]?.message?.content) {
      extractedContent = data.choices[0].message.content;
    } else if (typeof data === 'string') {
      extractedContent = data;
    } else {
      extractedContent = "Unexpected response format from AI.";
    }

    res.json({ enhancedPrompt: extractedContent.trim() });
  } catch (error: any) {
    console.error("Audio Prompt Enhancement Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI Generation Endpoint
app.post("/api/generate", async (req, res) => {
  try {
    const type = req.body.type || "text"; // 'text' or 'image'
    const topic = req.body.topic || "Surrealism";

    if (type === "text") {
      const { model, provider, baseUrl } = req.body;
      
      if (!model) {
        return res.status(400).json({ error: "Model is required. Please configure an AI model in AI Settings." });
      }
      if (!provider) {
        return res.status(400).json({ error: "Provider is required. Please configure an AI provider in AI Settings." });
      }
      if (!baseUrl) {
        return res.status(400).json({ error: "Base URL is required. Please configure an AI provider in AI Settings." });
      }
      console.log(`Generating text about "${topic}" via ${provider} with model: ${model}...`);

      // Construct full URL based on provider
      const fullUrl = provider === 'ollama' 
        ? `${baseUrl}/chat`
        : `${baseUrl}/api/v1/chat`;

      const randomSeed = Math.floor(Math.random() * 1000000);
      const payload = {
        model: model,
        seed: randomSeed,
        system_prompt: `You are Local Infinity. Generate a creative, surreal, and punchy observation specifically about the topic: "${topic}". Keep it 1-2 sentences.`,
        input: `Generate a surreal observation about "${topic}".`
      };

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(err => {
        console.error("Connection to AI provider failed:", err.message);
        throw new Error(`Connection to ${provider} failed at ${fullUrl}. Is the AI service running?`);
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("LM Studio returned an error:", errorText);
        throw new Error(`LM Studio error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json();
      console.log("LM Studio response data:", JSON.stringify(data).substring(0, 100) + "...");

      let extractedContent = "";
      if (typeof data === 'string') {
        extractedContent = data;
      } else if (data.output) {
        extractedContent = typeof data.output === 'object' ? (data.output.content || JSON.stringify(data.output)) : data.output;
      } else if (data.content) {
        extractedContent = typeof data.content === 'object' ? (data.content.content || JSON.stringify(data.content)) : data.content;
      } else if (data.choices?.[0]?.message?.content) {
        extractedContent = data.choices[0].message.content;
      } else {
        extractedContent = "Unexpected response format from AI.";
      }

      return res.json({
        content: extractedContent,
        seed: randomSeed,
        timestamp: Date.now()
      });
    }

    if (type === "image") {
      const { model, provider, baseUrl } = req.body;

      if (!model) {
        return res.status(400).json({ error: "Model is required. Please configure an AI model in AI Settings." });
      }
      if (!provider) {
        return res.status(400).json({ error: "Provider is required. Please configure an AI provider in AI Settings." });
      }
      if (!baseUrl) {
        return res.status(400).json({ error: "Base URL is required. Please configure an AI provider in AI Settings." });
      }

      console.log(`Generating image for topic: "${topic}" via ${provider} with model: ${model}...`);

      // Construct full URL based on provider
      const fullUrl = provider === 'ollama'
        ? `${baseUrl}/chat`
        : `${baseUrl}/api/v1/chat`;

      // Step 1: Enhance the prompt using LLM
      const enhancePayload = {
        model: model,
        system_prompt: "You are an expert at crafting detailed, realistic prompts for AI image generation models like SDXL. Your task is to take a simple user input and transform it into a rich, visually descriptive prompt that will produce photorealistic images grounded in reality. CRITICAL CONSTRAINTS: 1) NO sci-fi, fantasy, supernatural, or futuristic elements - stay strictly within realistic, contemporary settings 2) NO magical or impossible physics 3) NO alien, cybernetic, or synthetic elements 4) Focus on realistic details: natural lighting, authentic textures, real-world materials, believable compositions 5) Describe actual objects, people, places, or scenes that could exist in the real world 6) Keep the enhanced prompt concise (1-2 sentences) but packed with realistic visual information. Output ONLY the enhanced prompt, no explanations or extra text.",
        input: `Transform this simple concept into a realistic image generation prompt: "${topic}"`
      };

      const enhanceResponse = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enhancePayload),
      }).catch(err => {
        console.error("Connection to AI provider failed:", err.message);
        throw new Error(`Connection to ${provider} failed at ${fullUrl}. Is the AI service running?`);
      });

      if (!enhanceResponse.ok) {
        const errorText = await enhanceResponse.text();
        console.error("LLM returned an error:", errorText);
        throw new Error(`LLM error (${enhanceResponse.status}): ${errorText || enhanceResponse.statusText}`);
      }

      const enhanceData = await enhanceResponse.json();
      let enhancedPrompt = topic; // Fallback to original topic

      // Extract content from response
      if (enhanceData.output && Array.isArray(enhanceData.output)) {
        const messageObj = enhanceData.output.find((item: any) => item.type === 'message');
        enhancedPrompt = messageObj?.content || enhanceData.output[enhanceData.output.length - 1]?.content || topic;
      } else if (enhanceData.output) {
        enhancedPrompt = typeof enhanceData.output === 'object' ? (enhanceData.output.content || JSON.stringify(enhanceData.output)) : enhanceData.output;
      } else if (enhanceData.content) {
        enhancedPrompt = typeof enhanceData.content === 'object' ? (enhanceData.content.content || JSON.stringify(enhanceData.content)) : enhanceData.content;
      } else if (enhanceData.choices?.[0]?.message?.content) {
        enhancedPrompt = enhanceData.choices[0].message.content;
      } else if (typeof enhanceData === 'string') {
        enhancedPrompt = enhanceData;
      }

      enhancedPrompt = enhancedPrompt.trim();
      console.log("Enhanced prompt:", enhancedPrompt);

      // Step 2: Call the Python image generation worker (image-gen.py)
      const SD_URL = "http://localhost:7860/generate";
      const randomSeed = Math.floor(Math.random() * 1000000);
      const sdResponse = await fetch(SD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          seed: randomSeed,
          size: req.body.size || 16,
          steps: req.body.steps || 1,
          guidance_scale: req.body.guidance_scale || 0.0
        }),
      }).catch(err => {
        console.error("Python Image Worker not found on port 7860.");
        throw new Error("Could not reach your Python Image Worker (image-gen.py). Ensure you have run: python image-gen.py");
      });

      if (!sdResponse.ok) {
        const errData = await sdResponse.json();
        throw new Error(`Image AI error: ${errData.error || sdResponse.statusText}`);
      }

      const sdData = await sdResponse.json();

      // Step 3: Read the file from disk
      const imageBuffer = fs.readFileSync(sdData.path);
      const base64Image = `data:image/png;base64,${imageBuffer.toString("base64")}`;

      return res.json({
        imageUrl: base64Image,
        content: enhancedPrompt,
        seed: randomSeed,
        timestamp: Date.now()
      });
    }

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
