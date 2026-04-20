import os
import re
import sys
import time
import json
import threading
import torch
import torchaudio

# Add MMAudio directory to path for local mmaudio module
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'MMAudio'))

from mmaudio.eval_utils import ModelConfig, all_model_cfg, generate, setup_eval_logging
from mmaudio.model.flow_matching import FlowMatching
from mmaudio.model.networks import MMAudio, get_my_mmaudio
from mmaudio.model.utils.features_utils import FeaturesUtils


torch.backends.cuda.matmul.allow_tf32 = True
torch.backends.cudnn.allow_tf32 = True


class SFXGenerator:
    def __init__(self):
        self.net = None
        self.feature_utils = None
        self.fm = None
        self.rng = None
        self.model_config = None
        self.seq_cfg = None
        self.duration = 8.0
        self.sampling_rate = 44100  # MMAudio large_44k_v2 uses 44.1kHz
        self.text = "explosion with debris and rumble"
        self.negative_prompt = ""
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_sfx")
        self.device = self.get_device()
        self.cfg_strength = 4.5
        self.num_steps = 25
        self.seed = 42
        self.variant = "large_44k_v2"
        self.dtype = torch.bfloat16
        self.load_model()

    def get_device(self):
        if torch.cuda.is_available():
            device = torch.device("cuda")
            print(f"GPU detected: {torch.cuda.get_device_name(0)}")
            print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")
            print("MPS detected (Apple Silicon)")
        else:
            device = torch.device("cpu")
            print("No GPU detected, using CPU (this will be slow)")
        return device

    def load_model(self):
        print(f"Loading MMAudio model: {self.variant} (this may take a moment)...")
        
        if self.variant not in all_model_cfg:
            raise ValueError(f"Unknown model variant: {self.variant}")
        
        self.model_config: ModelConfig = all_model_cfg[self.variant]
        self.model_config.download_if_needed()
        self.seq_cfg = self.model_config.seq_cfg
        
        # Load the model
        self.net: MMAudio = get_my_mmaudio(self.model_config.model_name).to(self.device, self.dtype).eval()
        self.net.load_weights(torch.load(self.model_config.model_path, map_location=self.device, weights_only=True))
        
        # Setup feature utils
        self.feature_utils = FeaturesUtils(
            tod_vae_ckpt=self.model_config.vae_path,
            synchformer_ckpt=self.model_config.synchformer_ckpt,
            enable_conditions=True,
            mode=self.model_config.mode,
            bigvgan_vocoder_ckpt=self.model_config.bigvgan_16k_path,
            need_vae_encoder=False
        ).to(self.device, self.dtype).eval()
        
        # Setup flow matching
        self.fm = FlowMatching(min_sigma=0, inference_mode='euler', num_steps=self.num_steps)
        
        # Setup RNG
        self.rng = torch.Generator(device=self.device)
        self.rng.manual_seed(self.seed)
        
        self.sampling_rate = self.seq_cfg.sampling_rate
        print(f"MMAudio {self.variant} loaded on {self.device}!")
        print(f"Sample rate: {self.sampling_rate} Hz")

    def get_next_filename(self):
        pattern = re.compile(r"sfx_gen_(\d+)(?:-seed-\d+)?\.wav$")
        max_num = 0
        for f in os.listdir(self.output_dir):
            match = pattern.match(f)
            if match:
                max_num = max(max_num, int(match.group(1)))
        next_num = max_num + 1
        return os.path.join(self.output_dir, f"sfx_gen_{next_num:03d}-seed-{self.seed}.wav")

    def show_current_params(self):
        print(f"\n  Duration:      {self.duration} seconds")
        print(f"  Sampling Rate: {self.sampling_rate} Hz")
        print(f"  CFG Strength:  {self.cfg_strength}")
        print(f"  Num Steps:     {self.num_steps}")
        print(f"  Seed:          {self.seed}")
        print(f"  Model Variant: {self.variant}")
        print(f"  Text Prompt:   {self.text}")
        if self.negative_prompt:
            print(f"  Negative:      {self.negative_prompt}")

    def generate(self):
        print(f"\nGenerating SFX with current parameters...")
        self.show_current_params()
        
        # Update sequence lengths based on duration
        self.seq_cfg.duration = self.duration
        self.net.update_seq_lengths(
            self.seq_cfg.latent_seq_len,
            self.seq_cfg.clip_seq_len,
            self.seq_cfg.sync_seq_len
        )
        
        # Set RNG seed
        self.rng.manual_seed(self.seed)
        
        result = [None]
        done = threading.Event()
        start_time = time.time()
        
        # Estimate generation time (MMAudio is slower than AudioGen)
        tokens_per_sec = 2.0 if self.device.type == "cuda" else 0.3
        estimated_seconds = self.num_steps / tokens_per_sec
        
        def progress_worker():
            bar_width = 40
            while not done.is_set():
                elapsed = time.time() - start_time
                progress = min(1.0, elapsed / estimated_seconds)
                filled = int(bar_width * progress)
                bar = "█" * filled + "░" * (bar_width - filled)
                pct = progress * 100
                remaining = max(0, estimated_seconds - elapsed)
                sys.stdout.write(f"\r[{bar}] {pct:.0f}% | ETA: {remaining:.0f}s     ")
                sys.stdout.flush()
                time.sleep(0.5)
            
            elapsed = time.time() - start_time
            sys.stdout.write(f"\r[{'█' * bar_width}] 100% | Done in {elapsed:.1f}s     \n")
            sys.stdout.flush()
        
        def generate_worker():
            with torch.no_grad():
                # Text-to-audio mode (no video input)
                clip_frames = sync_frames = None
                
                audios = generate(
                    clip_frames,
                    sync_frames,
                    [self.text],
                    negative_text=[self.negative_prompt] if self.negative_prompt else [""],
                    feature_utils=self.feature_utils,
                    net=self.net,
                    fm=self.fm,
                    rng=self.rng,
                    cfg_strength=self.cfg_strength
                )
                result[0] = audios
                done.set()
        
        gen_thread = threading.Thread(target=generate_worker)
        prog_thread = threading.Thread(target=progress_worker)
        
        gen_thread.start()
        prog_thread.start()
        
        gen_thread.join()
        done.set()
        prog_thread.join()
        
        audio = result[0].float().cpu()[0]
        print("Audio generated! Saving to file...")
        
        output_path = self.get_next_filename()
        torchaudio.save(output_path, audio, self.sampling_rate, format="wav")
        
        # Save metadata JSON alongside the audio file
        metadata = {
            "prompt": self.text,
            "cfg": self.cfg_strength,
            "iterations": self.num_steps,
            "seed": self.seed,
            "duration": self.duration,
            "variant": self.variant,
            "negative_prompt": self.negative_prompt,
            "created_at": time.time()
        }
        metadata_path = output_path.replace('.wav', '.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Saved to: {output_path}")
        print(f"Metadata saved to: {metadata_path}\n")
        
        if self.device.type == "cuda":
            mem_gb = torch.cuda.max_memory_allocated() / (2**30)
            print(f"Peak VRAM usage: {mem_gb:.2f} GB")
    
    def run_menu(self):
        self.show_menu()
        while True:
            self.show_compact_status()
            cmd = input("> ").strip()
            
            if not cmd:
                continue
            
            parts = cmd.split(maxsplit=1)
            action = parts[0].lower()
            
            if action == "q":
                print("Exiting...")
                break
            elif action == "h" or action == "?":
                self.show_menu()
            elif action == "p":
                self.show_current_params()
            elif action == "d":
                if len(parts) > 1:
                    try:
                        self.duration = float(parts[1])
                        print(f"Duration: {self.duration}s")
                    except ValueError:
                        print("Invalid duration. Use: d <seconds>")
                else:
                    print(f"Duration: {self.duration}s")
            elif action == "c":
                if len(parts) > 1:
                    try:
                        self.cfg_strength = float(parts[1])
                        print(f"CFG Strength: {self.cfg_strength}")
                    except ValueError:
                        print("Invalid CFG strength. Use: c <value>")
                else:
                    print(f"CFG Strength: {self.cfg_strength}")
            elif action == "n":
                if len(parts) > 1:
                    try:
                        self.num_steps = int(parts[1])
                        # Update flow matching with new steps
                        self.fm = FlowMatching(min_sigma=0, inference_mode='euler', num_steps=self.num_steps)
                        print(f"Num Steps: {self.num_steps}")
                    except ValueError:
                        print("Invalid num steps. Use: n <value>")
                else:
                    print(f"Num Steps: {self.num_steps}")
            elif action == "sd":
                if len(parts) > 1:
                    try:
                        self.seed = int(parts[1])
                        print(f"Seed: {self.seed}")
                    except ValueError:
                        print("Invalid seed. Use: sd <value>")
                else:
                    print(f"Seed: {self.seed}")
            elif action == "neg":
                if len(parts) > 1:
                    self.negative_prompt = parts[1]
                    print(f"Negative prompt: {self.negative_prompt}")
                else:
                    self.negative_prompt = ""
                    print("Negative prompt cleared")
            elif action == "t":
                if len(parts) > 1:
                    self.text = parts[1]
                    print(f"Text: {self.text}")
                else:
                    print(f"Text: {self.text}")
            elif action == "g":
                self.generate()
            elif action == "v":
                if len(parts) > 1:
                    variant = parts[1]
                    if variant in all_model_cfg:
                        self.variant = variant
                        print(f"Switching to variant: {variant}")
                        self.load_model()
                    else:
                        print(f"Unknown variant: {variant}")
                        print(f"Available: {', '.join(all_model_cfg.keys())}")
                else:
                    print(f"Current variant: {self.variant}")
                    print(f"Available: {', '.join(all_model_cfg.keys())}")
            else:
                print(f"Unknown command: {action}. Press h for help.")
    
    def show_menu(self):
        print("\n========== SFX Generator (MMAudio) ==========")
        print(f"Model: MMAudio {self.variant}")
        print("Note: Requires mmaudio library")
        print("Commands:")
        print("  d <sec>    - Set duration (current: {}s)".format(self.duration))
        print("  c <val>    - Set CFG strength (current: {})".format(self.cfg_strength))
        print("  n <steps>  - Set num steps (current: {})".format(self.num_steps))
        print("  sd <seed>  - Set seed (current: {})".format(self.seed))
        print("  neg <text> - Set negative prompt (current: {})".format(self.negative_prompt if self.negative_prompt else "None"))
        print("  t <text>   - Set prompt (current: {})".format(self.text[:30] + "..." if len(self.text) > 30 else self.text))
        print("  v <var>    - Switch variant (small_16k, small_44k, medium_44k, large_44k, large_44k_v2)")
        print("  p          - Show all parameters")
        print("  g          - Generate SFX")
        print("  h / ?      - Show this help")
        print("  q          - Quit")
        print("============================================")
    
    def show_compact_status(self):
        short_text = self.text[:20] + "..." if len(self.text) > 20 else self.text
        print(f"[{self.duration}s | {self.variant} | \"{short_text}\"]")


if __name__ == "__main__":
    generator = SFXGenerator()
    generator.run_menu()
