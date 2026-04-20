import os
import re
import sys
import time
import threading
import torch
import scipy.io.wavfile
from transformers import AutoProcessor, AutoModelForTextToWaveform


class MusicGenerator:
    def __init__(self):
        self.model = None
        self.processor = None
        self.duration = 5
        self.sampling_rate = 32000
        self.text = "deep bassy techno beat with synths and arpeggio"
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_music")
        self.device = self.get_device()
        self.load_model()

    def get_device(self):
        if torch.cuda.is_available():
            device = torch.device("cuda")
            print(f"GPU detected: {torch.cuda.get_device_name(0)}")
            print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        else:
            device = torch.device("cpu")
            print("No GPU detected, using CPU (this will be slow)")
        return device

    def load_model(self):
        print("Loading MusicGen Stereo Large model (this may take a moment)...")
        self.processor = AutoProcessor.from_pretrained("facebook/musicgen-stereo-large")
        self.model = AutoModelForTextToWaveform.from_pretrained("facebook/musicgen-stereo-large", use_safetensors=True)
        self.model = self.model.to(self.device)
        print(f"MusicGen Stereo Large loaded on {self.device}!")

    def get_next_filename(self):
        pattern = re.compile(r"music_gen_(\d+)\.wav$")
        max_num = 0
        for f in os.listdir(self.output_dir):
            match = pattern.match(f)
            if match:
                max_num = max(max_num, int(match.group(1)))
        next_num = max_num + 1
        return os.path.join(self.output_dir, f"music_gen_{next_num:03d}.wav")

    def show_current_params(self):
        print(f"\n  Duration:      {self.duration} seconds")
        print(f"  Sampling Rate: {self.sampling_rate} Hz")
        print(f"  Text Prompt:   {self.text}")

    def generate(self):
        print(f"\nGenerating music with current parameters...")
        self.show_current_params()

        print("Preparing inputs...")
        inputs = self.processor(
            text=[self.text],
            return_tensors="pt"
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        sampling_rate = self.model.config.audio_encoder.sampling_rate
        max_new_tokens = int(self.duration * sampling_rate / self.model.config.audio_encoder.config.frame_size)

        result = [None]
        done = threading.Event()
        start_time = time.time()
        estimated_seconds = self.duration * 3 if self.device.type == "cuda" else self.duration * 15

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
                audio_values = self.model.generate(**inputs, max_new_tokens=max_new_tokens)
                result[0] = audio_values
            done.set()

        gen_thread = threading.Thread(target=generate_worker)
        prog_thread = threading.Thread(target=progress_worker)

        gen_thread.start()
        prog_thread.start()

        interrupted = False
        try:
            gen_thread.join()
            done.set()
            prog_thread.join()
        except KeyboardInterrupt:
            interrupted = True
            done.set()
            prog_thread.join()
            print("\n\nGeneration interrupted by user.")
            gen_thread.join()

        if interrupted:
            print("Discarding incomplete generation. Returning to menu...\n")
            return

        audio_values = result[0]
        print("Audio generated! Saving to file...")
        output_path = self.get_next_filename()
        audio_data = audio_values[0, 0].cpu().numpy()
        sampling_rate = self.model.config.audio_encoder.sampling_rate
        scipy.io.wavfile.write(output_path, rate=sampling_rate, data=audio_data)
        print(f"Saved to: {output_path}\n")

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
            elif action == "s":
                if len(parts) > 1:
                    try:
                        self.sampling_rate = int(parts[1])
                        print(f"Sampling rate: {self.sampling_rate}Hz")
                    except ValueError:
                        print("Invalid rate. Use: s <hz>")
                else:
                    print(f"Sampling rate: {self.sampling_rate}Hz")
            elif action == "t":
                if len(parts) > 1:
                    self.text = parts[1]
                    print(f"Text: {self.text}")
                else:
                    print(f"Text: {self.text}")
            elif action == "g":
                self.generate()
            else:
                print(f"Unknown command: {action}. Press h for help.")

    def show_menu(self):
        print("\n========== Music Generator ==========")
        print("Model: MusicGen Small")
        print("Commands:")
        print("  d <sec>    - Set duration (current: {}s)".format(self.duration))
        print("  s <hz>     - Set sampling rate (current: {}Hz)".format(self.sampling_rate))
        print("  t <text>   - Set prompt (current: {})".format(self.text[:30] + "..." if len(self.text) > 30 else self.text))
        print("  p          - Show all parameters")
        print("  g          - Generate music")
        print("  h / ?      - Show this help")
        print("  q          - Quit")
        print("=====================================")

    def show_compact_status(self):
        short_text = self.text[:20] + "..." if len(self.text) > 20 else self.text
        print(f"[{self.duration}s | {self.sampling_rate}Hz | \"{short_text}\"]")


if __name__ == "__main__":
    generator = MusicGenerator()
    generator.run_menu()
