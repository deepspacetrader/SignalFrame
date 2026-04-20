export type GenerationType = 'image' | 'audio';

export interface BatchTask {
  id: string;
  type: GenerationType;
  text: string;
  size?: number;
  cacheKey?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: string; // URL of generated media
  createdAt: Date;
}

interface BatchManagerState {
  queue: BatchTask[];
  isProcessing: boolean;
  currentType: GenerationType | null;
}

class BatchManager {
  private state: BatchManagerState = {
    queue: [],
    isProcessing: false,
    currentType: null
  };

  private listeners = new Set<(state: BatchManagerState) => void>();
  private processTimeout: NodeJS.Timeout | null = null;

  getState(): BatchManagerState {
    return { ...this.state };
  }

  subscribe(listener: (state: BatchManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.getState()));
  }

  addTask(task: Omit<BatchTask, 'id' | 'status' | 'createdAt'>): string {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: BatchTask = {
      ...task,
      id,
      status: 'queued',
      createdAt: new Date()
    };

    this.state.queue.push(newTask);
    this.notify();

    // Start processing if not already processing
    if (!this.state.isProcessing) {
      this.scheduleProcessing();
    }

    return id;
  }

  private scheduleProcessing() {
    if (this.processTimeout) {
      clearTimeout(this.processTimeout);
    }
    // Small delay to allow multiple tasks to be queued before processing starts
    this.processTimeout = setTimeout(() => this.processQueue(), 500);
  }

  private async processQueue() {
    if (this.state.isProcessing || this.state.queue.length === 0) {
      return;
    }

    this.state.isProcessing = true;
    this.notify();

    try {
      // Group tasks by type
      const imageTasks = this.state.queue.filter(t => t.type === 'image' && t.status === 'queued');
      const audioTasks = this.state.queue.filter(t => t.type === 'audio' && t.status === 'queued');

      // Process all images first, then all audio
      await this.processBatch(imageTasks, 'image');
      await this.processBatch(audioTasks, 'audio');
    } finally {
      // Remove completed/failed tasks from queue
      this.state.queue = this.state.queue.filter(t => t.status === 'queued');
      this.state.isProcessing = false;
      this.state.currentType = null;
      this.notify();

      // Check if there are new tasks added during processing
      if (this.state.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  private async processBatch(tasks: BatchTask[], type: GenerationType) {
    if (tasks.length === 0) return;

    this.state.currentType = type;
    this.notify();

    // Process tasks sequentially (could be parallelized if resources allow)
    for (const task of tasks) {
      task.status = 'processing';
      this.notify();

      try {
        if (type === 'image') {
          await this.processImageTask(task);
        } else if (type === 'audio') {
          await this.processAudioTask(task);
        }
        task.status = 'completed';
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
      }

      this.notify();
    }

    // Unload the model after batch processing completes to save VRAM
    try {
      if (type === 'image') {
        await fetch('http://localhost:3322/unload', { method: 'POST' });
      } else if (type === 'audio') {
        const { useSituationStore } = await import('../state/useSituationStore');
        const { aiConfig } = useSituationStore();
        const audioProvider = aiConfig.audioProvider || 'tangoflux';
        const baseUrl = audioProvider === 'tangoflux' ? 'http://localhost:7861' : 'http://localhost:7860';
        await fetch(`${baseUrl}/api/model/unload`, { method: 'POST' });
      }
    } catch (error) {
      console.error('Failed to unload model after batch:', error);
    }
  }

  private async processImageTask(task: BatchTask) {
    // Get AI config from store
    const { useSituationStore } = await import('../state/useSituationStore');
    const { aiConfig, updateMediaUrls } = useSituationStore();

    // First, enhance the prompt using the LLM for image generation
    const promptResponse = await fetch('http://localhost:3322/api/enhance-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: task.text,
        provider: aiConfig.provider,
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model
      })
    });

    if (!promptResponse.ok) {
      throw new Error('Failed to enhance prompt');
    }

    const promptData = await promptResponse.json();
    const enhancedPrompt = promptData.enhancedPrompt || task.text;

    // Truncate enhanced prompt to fit CLIP token limit
    const truncatedPrompt = enhancedPrompt.length > 300
      ? enhancedPrompt.substring(0, 300)
      : enhancedPrompt;

    // Generate the image with auto_unload=false to keep model loaded for batch
    const imageResponse = await fetch('http://localhost:3322/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: truncatedPrompt,
        size: task.size || 128,
        guidance_scale: 1.0,
        auto_unload: false // Keep model loaded for batch processing
      })
    });

    if (!imageResponse.ok) {
      throw new Error('Failed to generate image');
    }

    const imageData = await imageResponse.json();
    const imageUrl = `/signalframe/generated_images/${imageData.filename}`;

    // Cache the image URL
    if (task.cacheKey) {
      updateMediaUrls({ [task.cacheKey]: imageUrl });
    }

    task.result = imageUrl;
  }

  private async processAudioTask(task: BatchTask) {
    // Get AI config from store
    const { useSituationStore } = await import('../state/useSituationStore');
    const { aiConfig, updateMediaUrls } = useSituationStore();

    const audioProvider = aiConfig.audioProvider || 'tangoflux';
    const baseUrl = audioProvider === 'tangoflux' ? 'http://localhost:7861' : 'http://localhost:7860';

    // First, enhance the prompt using the audio-gen API (only for MMAudio)
    let enhancedPrompt = task.text;
    let negativePrompt = '';

    if (audioProvider === 'mmaudio') {
      const promptResponse = await fetch(`${baseUrl}/api/prompt/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_text: task.text,
          llm_provider: aiConfig.provider,
          llm_model: aiConfig.model,
          llm_base_url: aiConfig.baseUrl
        })
      });

      if (!promptResponse.ok) {
        throw new Error('Failed to generate prompt');
      }

      const promptData = await promptResponse.json();
      enhancedPrompt = promptData.prompt || task.text;
      negativePrompt = promptData.negative_prompt || '';
    }

    // Set the SFX parameters with auto_unload=false to keep model loaded for batch
    const paramsBody: any = {
      text: enhancedPrompt,
      duration: 2.0,
      num_steps: 25,
      auto_unload: false // Keep model loaded for batch processing
    };

    if (audioProvider === 'mmaudio') {
      paramsBody.negative_prompt = negativePrompt;
      paramsBody.cfg_strength = 4.5;
      paramsBody.seed = -1;
    }

    await fetch(`${baseUrl}/api/sfx/params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paramsBody)
    });

    // Generate the sound effect
    const sfxResponse = await fetch(`${baseUrl}/api/sfx/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!sfxResponse.ok) {
      throw new Error('Failed to generate sound effect');
    }

    const sfxData = await sfxResponse.json();

    if (!sfxData.success) {
      throw new Error(sfxData.error || 'Generation failed');
    }

    const audioUrl = `${baseUrl}${sfxData.filepath}`;

    // Cache the audio URL
    if (task.cacheKey) {
      updateMediaUrls({ [task.cacheKey]: audioUrl });
    }

    task.result = audioUrl;
  }

  clearQueue() {
    this.state.queue = [];
    this.state.isProcessing = false;
    this.state.currentType = null;
    this.notify();
  }

  getQueueLength(): number {
    return this.state.queue.length;
  }

  getProcessingCount(): number {
    return this.state.queue.filter(t => t.status === 'processing').length;
  }

  getCompletedCount(): number {
    return this.state.queue.filter(t => t.status === 'completed').length;
  }

  getFailedCount(): number {
    return this.state.queue.filter(t => t.status === 'failed').length;
  }
}

// Singleton instance
export const batchManager = new BatchManager();
