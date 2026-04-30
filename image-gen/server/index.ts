import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (2 levels up: server -> image-gen -> project-root)
const envPath = path.join(__dirname, '../../.env');
console.log('[Server] __dirname:', __dirname);
console.log('[Server] Attempting to load .env from:', envPath);
console.log('[Server] File exists:', fs.existsSync(envPath));

const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
  console.error('[Server] dotenv error:', dotenvResult.error);
} else {
  console.log('[Server] dotenv parsed keys:', Object.keys(dotenvResult.parsed || {}));
}

console.log('[Server] NVIDIA_IMAGE_GEN_KEY present:', process.env.NVIDIA_IMAGE_GEN_KEY ? 'Yes' : 'No');

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

// Image Generation Endpoint (used by batchManager)
app.post("/generate", async (req, res) => {
  try {
    const { prompt, size, guidance_scale, auto_unload, provider } = req.body;
    console.log(`[Generate] Request received - provider: ${provider || 'sdxl'}, prompt: "${prompt?.substring(0, 50)}..."`);

    if (!prompt) {
      console.log('[Generate] Error: Prompt is required');
      return res.status(400).json({ error: "Prompt is required" });
    }

    const imageProvider = provider || 'sdxl';
    console.log(`[Generate] Using provider: ${imageProvider}`);

    // NVIDIA FLUX.2 Klein Provider
    if (imageProvider === 'nvidia-flux') {
      try {
        console.log('[Generate] NVIDIA FLUX provider selected');
        const NVIDIA_API_KEY = process.env.NVIDIA_IMAGE_GEN_KEY;
        console.log(`[Generate] API Key present: ${NVIDIA_API_KEY ? 'Yes (first 10 chars: ' + NVIDIA_API_KEY.substring(0, 10) + '...)' : 'NO - check env vars!'}`);
        
        if (!NVIDIA_API_KEY) {
          console.error('[Generate] NVIDIA_IMAGE_GEN_KEY not set!');
          return res.status(500).json({ error: "NVIDIA_IMAGE_GEN_KEY environment variable not set" });
        }

        const invokeUrl = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b";
        const headers = {
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        };

        // NVIDIA FLUX requires minimum 512px and specific dimensions (multiples of 16 from 512-1568)
        const minSize = 512;
        let targetSize = Math.max(size || 512, minSize);
        // Round up to nearest multiple of 16 within valid range
        targetSize = Math.ceil(targetSize / 16) * 16;
        targetSize = Math.min(targetSize, 1568); // Max supported size

        const payload = {
          prompt: prompt,
          width: targetSize,
          height: targetSize,
          seed: 0,
          steps: 4
        };
        console.log(`[Generate] Calling NVIDIA API with payload:`, JSON.stringify(payload));

        const response = await fetch(invokeUrl, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(payload)
        });

        console.log(`[Generate] NVIDIA API response status: ${response.status}`);

        if (response.status !== 200) {
          const errBody = await response.text();
          console.error(`[Generate] NVIDIA API error: ${response.status} - ${errBody}`);
          return res.status(500).json({ error: `NVIDIA FLUX invocation failed with status ${response.status}: ${errBody}` });
        }

        const responseBody = await response.json();
        // console.log(`[Generate] NVIDIA API response keys: ${Object.keys(responseBody).join(', ')}`);

        // Extract base64 image from response
        // console.log('[Generate] Full NVIDIA response:', JSON.stringify(responseBody, null, 2));
        
        // Try various possible response formats
        let base64Image = responseBody.image || 
                         responseBody.images?.[0] || 
                         responseBody.data?.[0]?.b64_json ||
                         responseBody.data?.[0]?.image ||
                         responseBody.artifacts?.[0]?.base64;
        
        console.log(`[Generate] Extracted base64 image: ${base64Image ? 'Yes (length: ' + base64Image.length + ')' : 'NO - check response structure'}`);
        
        if (!base64Image) {
          console.error('[Generate] No image data in response. Response keys:', Object.keys(responseBody));
          return res.status(500).json({ error: "No image data received from NVIDIA API. Response keys: " + Object.keys(responseBody).join(', ') });
        }

        // Save to file (same location as SDXL: public/generated_images)
        const outputDir = path.join(__dirname, '../../public/generated_images');
        console.log(`[Generate] Output directory: ${outputDir}`);
        
        if (!fs.existsSync(outputDir)) {
          console.log(`[Generate] Creating output directory...`);
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const randomSeed = Math.floor(Math.random() * 1000000);
        const filename = `${Date.now()}_${randomSeed}.png`;
        const outputPath = path.join(outputDir, filename);
        console.log(`[Generate] Writing file: ${outputPath}`);

        const imageBuffer = Buffer.from(base64Image, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`[Generate] File written successfully`);

        res.json({
          filename,
          path: outputPath,
          seed: randomSeed
        });
        return;
      } catch (nvidiaError: any) {
        console.error('[Generate] NVIDIA FLUX Error:', nvidiaError);
        console.error('[Generate] Error stack:', nvidiaError.stack);
        return res.status(500).json({ error: `NVIDIA FLUX error: ${nvidiaError.message}` });
      }
    }

    // SDXL Turbo Provider (default/local)
    const SD_URL = "http://localhost:7860/generate";
    const randomSeed = Math.floor(Math.random() * 1000000);
    const sdResponse = await fetch(SD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        seed: randomSeed,
        size: size || 512,
        guidance_scale: guidance_scale || 1.0,
        auto_unload: auto_unload !== false
      }),
    }).catch(err => {
      console.error("Python Image Worker not found on port 7860.", err.message);
      throw new Error("Could not reach your Python Image Worker (image-gen.py). Ensure you have run: python image-gen/image-gen.py");
    });

    if (!sdResponse.ok) {
      const errData = await sdResponse.json().catch(() => ({}));
      throw new Error(`Image AI error: ${errData.error || sdResponse.statusText}`);
    }

    const sdData = await sdResponse.json();

    // Copy the generated file to the public directory for serving (same as NVIDIA FLUX)
    const outputDir = path.join(__dirname, '../../public/generated_images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `${Date.now()}_${randomSeed}.png`;
    const outputPath = path.join(outputDir, filename);

    // Copy file from temp location to output directory
    fs.copyFileSync(sdData.path, outputPath);

    res.json({
      filename,
      path: outputPath,
      seed: randomSeed
    });
  } catch (error: any) {
    console.error("[Generate] Image Generation Error:", error);
    console.error("[Generate] Error stack:", error.stack);
    res.status(500).json({ error: error.message || "Unknown error during image generation" });
  }
});

// Unload endpoint for SDXL model
app.post("/unload", async (req, res) => {
  try {
    // Forward the unload request to the Python image generation server
    const SD_UNLOAD_URL = "http://localhost:7860/unload";
    const response = await fetch(SD_UNLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }).catch(err => {
      console.error("Python Image Worker not found on port 7860.", err.message);
      // Return success even if Python server isn't running - nothing to unload
      return { ok: true, json: async () => ({ success: true }) } as Response;
    });

    if (response.ok) {
      res.json({ success: true, message: "SDXL model unloaded" });
    } else {
      res.status(500).json({ error: "Failed to unload SDXL model" });
    }
  } catch (error: any) {
    console.error("Unload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
