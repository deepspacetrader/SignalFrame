import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in parent directory
config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// NVIDIA TTS endpoint
app.post('/api/nvidia-tts', async (req, res) => {
  try {
    const { text, voice = 'Magpie-Multilingual.EN-US.Aria', languageCode = 'en-US', emotion = 'default' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Get API key from environment
    const apiKey = process.env.VITE_NVIDIA_KEY || process.env.NVIDIA_KEY;
    if (!apiKey) {
      console.error('NVIDIA_API_KEY not found in environment');
      return res.status(500).json({ error: 'NVIDIA API key not configured' });
    }

    // Split text into chunks if it's too long (max 2000 chars for NVIDIA API)
    const maxChunkLength = 1800; // Leave some buffer
    const textChunks = [];
    
    if (text.length <= maxChunkLength) {
      textChunks.push(text);
    } else {
      // Split by sentences to avoid cutting words
      const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChunkLength) {
          currentChunk += sentence;
        } else {
          if (currentChunk) {
            textChunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        }
      }
      
      if (currentChunk) {
        textChunks.push(currentChunk.trim());
      }
    }
    
    console.log(`[NVIDIA TTS] Processing request: "${text.substring(0, 50)}..." with voice: ${voice}`);
    console.log(`[NVIDIA TTS] Text length: ${text.length} chars, split into ${textChunks.length} chunks`);
    console.log(`[NVIDIA TTS] Emotion: ${emotion}`);

    // Voice-emotion compatibility mapping based on official NVIDIA NIM documentation
// Format: Magpie-Multilingual.{LOCALE}.{Speaker}[.{Emotion}]
// Only specific speakers have emotional variants in EN-US
const VOICE_EMOTION_COMPATIBILITY = {
  // Base voices (no emotion)
  'Magpie-Multilingual.EN-US.Aria': ['default'],
  'Magpie-Multilingual.EN-US.Sofia': ['default'],
  'Magpie-Multilingual.EN-US.Mia': ['default'],
  'Magpie-Multilingual.EN-US.Louise': ['default'], // No emotional variants
  'Magpie-Multilingual.EN-US.Isabela': ['default'], // No emotional variants in EN-US
  
  // Aria (EN-US) - 6 emotions: Angry, Calm, Fearful, Happy, Neutral, Sad
  'Magpie-Multilingual.EN-US.Aria.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Aria.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Aria.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Aria.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Aria.Neutral': ['neutral'],
  'Magpie-Multilingual.EN-US.Aria.Sad': ['sad'],
  
  // Sofia (EN-US) - 5 emotions (excluding one from the 6)
  'Magpie-Multilingual.EN-US.Sofia.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Sofia.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Sofia.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Sofia.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Sofia.Neutral': ['neutral'],
  // Note: Sofia doesn't support Sad based on documentation
  
  // Mia (EN-US) - 5 emotions
  'Magpie-Multilingual.EN-US.Mia.Angry': ['angry'],
  'Magpie-Multilingual.EN-US.Mia.Calm': ['calm'],
  'Magpie-Multilingual.EN-US.Mia.Fearful': ['fearful'],
  'Magpie-Multilingual.EN-US.Mia.Happy': ['happy'],
  'Magpie-Multilingual.EN-US.Mia.Neutral': ['neutral'],
  // Note: Mia doesn't support Sad based on documentation
}

const validateEmotionCompatibility = (voice, emotion) => {
  console.log(`[NVIDIA TTS] Validating emotion compatibility: voice="${voice}", emotion="${emotion}"`)
  if (!emotion || emotion === 'default') {
    console.log(`[NVIDIA TTS] Emotion is default or empty, allowing`)
    return true
  }
  const supportedEmotions = VOICE_EMOTION_COMPATIBILITY[voice] || ['default']
  console.log(`[NVIDIA TTS] Supported emotions for ${voice}:`, supportedEmotions)
  const isCompatible = supportedEmotions.includes(emotion)
  console.log(`[NVIDIA TTS] Emotion compatibility result: ${isCompatible}`)
  return isCompatible
}

    // Wrap text in SSML with emotion if emotion is specified and not default
    const wrapTextWithEmotion = (text, emotion) => {
      if (emotion && emotion !== 'default') {
        return `<speak><prosody emotion="${emotion}">${text}</prosody></speak>`
      }
      return text
    }

    const processTextChunk = (chunk, emotion, voice) => {
      // For Magpie TTS, emotions are accessed through specific voice names, not SSML
      console.log(`[NVIDIA TTS] Processing chunk with emotion: ${emotion}`)
      
      if (emotion && emotion !== 'default') {
        const emotionVoiceName = `${voice}.${emotion.charAt(0).toUpperCase() + emotion.slice(1)}`
        console.log(`[NVIDIA TTS] Trying emotion-specific voice: ${emotionVoiceName}`)
        
        // Check if this emotion-specific voice name is in our compatibility map
        if (VOICE_EMOTION_COMPATIBILITY[emotionVoiceName]) {
          console.log(`[NVIDIA TTS] Using emotion-specific voice: ${emotionVoiceName}`)
          // Return object indicating to use emotion-specific voice
          return { text: chunk, useEmotionVoice: true, emotionVoiceName }
        } else {
          console.warn(`[NVIDIA TTS] Emotion-specific voice ${emotionVoiceName} not found, falling back to plain text`)
          return chunk // Return plain text without emotion
        }
      }
      
      console.log(`[NVIDIA TTS] Using default voice without emotion`)
      return chunk // Return plain text for default emotion
    }

    // Process each chunk and combine audio
    const audioBuffers = [];
    let hasVoiceError = false;
    let failedChunks = [];
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const processedResult = processTextChunk(chunk, emotion, voice);
      const timestamp = Date.now() + i;
      const outputFile = path.join(__dirname, `temp_${timestamp}.wav`);
      
      let processedChunk, voiceToUse;
      
      if (typeof processedResult === 'object' && processedResult.useEmotionVoice) {
        processedChunk = processedResult.text;
        voiceToUse = processedResult.emotionVoiceName;
        console.log(`[NVIDIA TTS] Using emotion-specific voice: ${voiceToUse}`)
      } else {
        processedChunk = processedResult;
        voiceToUse = voice;
      }
      
      console.log(`[NVIDIA TTS] Processing chunk ${i + 1}/${textChunks.length}: "${chunk.substring(0, 50)}..."`);
      console.log(`[NVIDIA TTS] Using voice: ${voiceToUse} for chunk ${i + 1}`);

      // Try with selected voice first, then fallback to Aria if it fails
      const voiceToTry = hasVoiceError ? 'Magpie-Multilingual.EN-US.Aria' : voiceToUse;

      // Call official Python script with full miniconda path
      const pythonProcess = spawn('C:\\Users\\PC\\miniconda3\\python.exe', [
        'd:\\htdocs\\SignalFrame\\python-clients\\scripts\\tts\\talk.py',
        '--server', 'grpc.nvcf.nvidia.com:443',
        '--use-ssl',
        '--metadata', 'function-id', '877104f7-e885-42b9-8de8-f6e4c6303969',
        '--metadata', 'authorization', `Bearer ${apiKey}`,
        '--language-code', languageCode,
        '--voice', voiceToTry,
        '--text', processedChunk,
        '--output', outputFile
      ]);

      // Wait for this chunk to complete before processing the next
      try {
        await new Promise((resolve, reject) => {
          let stdout = '';
          let stderr = '';

          pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          pythonProcess.on('close', (code) => {
            console.log(`[NVIDIA TTS] Chunk ${i + 1} Python process exited with code: ${code}`);
            console.log(`[NVIDIA TTS] Chunk ${i + 1} Python stdout: ${stdout}`);
            console.log(`[NVIDIA TTS] Chunk ${i + 1} Python stderr: ${stderr}`);
            
            if (code !== 0) {
              console.error(`[NVIDIA TTS] Chunk ${i + 1} Error: ${stderr}`);
              
              // Check if this is a voice-related error
              if (stderr.includes('voice') || stderr.includes('Voice') || stderr.includes('not found') || stderr.includes('Invalid')) {
                console.warn(`[NVIDIA TTS] Voice ${voiceToTry} failed, will try fallback for remaining chunks`);
                hasVoiceError = true;
              }
              
              reject(new Error(`TTS generation failed for chunk ${i + 1}: ${stderr}`));
              return;
            }

            // Check if output file exists
            if (!fs.existsSync(outputFile)) {
              console.error(`[NVIDIA TTS] Chunk ${i + 1} Output file not found: ${outputFile}`);
              reject(new Error(`Audio file not generated for chunk ${i + 1}`));
              return;
            }

            // Check file size before reading
            const fileStats = fs.statSync(outputFile);
            console.log(`[NVIDIA TTS] Chunk ${i + 1} Output file size: ${fileStats.size} bytes`);
            
            if (fileStats.size < 1000) {
              console.error(`[NVIDIA TTS] Chunk ${i + 1} Output file too small: ${fileStats.size} bytes`);
              
              // Check if this is a voice-related error
              if (stderr.includes('voice') || stderr.includes('Voice') || stderr.includes('not found') || stderr.includes('Invalid')) {
                console.warn(`[NVIDIA TTS] Voice ${voiceToTry} failed, will try fallback for remaining chunks`);
                hasVoiceError = true;
              }
              
              reject(new Error(`Generated audio file for chunk ${i + 1} is too small`));
              return;
            }

            // Read and store the audio buffer
            const audioBuffer = fs.readFileSync(outputFile);
            console.log(`[NVIDIA TTS] Chunk ${i + 1} Audio buffer size: ${audioBuffer.length} bytes`);
            
            // Clean up temp file
            fs.unlink(outputFile, (err) => {
              if (err) console.warn(`[NVIDIA TTS] Failed to cleanup temp file for chunk ${i + 1}: ${err.message}`);
            });
            
            audioBuffers.push(audioBuffer);
            resolve(null);
          });

          pythonProcess.on('error', (error) => {
            console.error(`[NVIDIA TTS] Chunk ${i + 1} Python process error: ${error.message}`);
            reject(new Error(`Failed to execute Python client for chunk ${i + 1}: ${error.message}`));
          });
        });
      } catch (chunkError) {
        console.warn(`[NVIDIA TTS] Failed to process chunk ${i + 1}, continuing with remaining chunks:`, chunkError.message);
        failedChunks.push(i + 1);
        
        // Clean up temp file if it exists
        if (fs.existsSync(outputFile)) {
          fs.unlink(outputFile, (err) => {
            if (err) console.warn(`[NVIDIA TTS] Failed to cleanup temp file for failed chunk ${i + 1}: ${err.message}`);
          });
        }
      }
    }

    // Combine all audio buffers
    const combinedAudio = Buffer.concat(audioBuffers);
    console.log(`[NVIDIA TTS] Successfully generated combined audio: ${combinedAudio.length} bytes from ${audioBuffers.length} chunks`);
    
    // Log individual chunk sizes for debugging
    audioBuffers.forEach((buffer, index) => {
      console.log(`[NVIDIA TTS] Chunk ${index + 1}: ${buffer.length} bytes`);
    });
    
    // Log failed chunks if any
    if (failedChunks.length > 0) {
      console.warn(`[NVIDIA TTS] Failed to process ${failedChunks.length} chunk(s): ${failedChunks.join(', ')}`);
    }
    
    // Ensure we have at least some audio to return
    if (audioBuffers.length === 0) {
      console.error('[NVIDIA TTS] No audio chunks were successfully processed');
      return res.status(500).json({ error: 'Failed to generate any audio from the provided text' });
    }
    
    // Send combined audio file with metadata about processing
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('X-Processed-Chunks', audioBuffers.length.toString());
    res.setHeader('X-Total-Chunks', textChunks.length.toString());
    res.setHeader('X-Failed-Chunks', failedChunks.length.toString());
    
    if (failedChunks.length > 0) {
      console.warn(`[NVIDIA TTS] Returning partial audio: ${audioBuffers.length}/${textChunks.length} chunks processed successfully`);
    }
    
    res.send(combinedAudio);

  } catch (error) {
    console.error('[NVIDIA TTS] Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/nvidia-tts/health', (req, res) => {
  res.json({ status: 'ok', message: 'NVIDIA TTS service is running' });
});

app.listen(PORT, () => {
  console.log(`[NVIDIA TTS] Server running on port ${PORT}`);
  console.log(`[NVIDIA TTS] Health check: http://localhost:${PORT}/api/nvidia-tts/health`);
});
