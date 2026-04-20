import os
import re
import sys
import time
import threading
import torch
from audiocraft.models import AudioGen
from audiocraft.data.audio import audio_write


class SFXGenerator:
    def __init__(self):
        self.model = None
        self.duration = 5
        self.sampling_rate = 16000
        self.text = "explosion with debris and rumble"
        self.output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output_sfx")
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
        print("Loading AudioGen Medium model (this may take a moment)...")
        self.model = AudioGen.get_pretrained("facebook/audiogen-medium", device=self.device)
        print(f"AudioGen Medium loaded on {self.device}!")

    def get_next_filename(self):
        pattern = re.compile(r"sfx_gen_(\d+)\.wav$")
        max_num = 0
        for f in os.listdir(self.output_dir):
            match = pattern.match(f)
            if match:
                max_num = max(max_num, int(match.group(1)))
        next_num = max_num + 1
        return os.path.join(self.output_dir, f"sfx_gen_{next_num:03d}.wav")

    def show_current_params(self):
        print(f"\n  Duration:      {self.duration} seconds")
        print(f"  Sampling Rate: {self.sampling_rate} Hz")
        print(f"  Text Prompt:   {self.text}")

    def generate(self):
        print(f"\nGenerating SFX with current parameters...")
        self.show_current_params()

        print("Generating audio...")
        self.model.set_generation_params(duration=self.duration)

        result = [None]
        done = threading.Event()
        start_time = time.time()

        tokens_per_sec = 5.0 if self.device.type == "cuda" else 0.5
        max_new_tokens = int(self.duration * 50)
        estimated_seconds = max_new_tokens / tokens_per_sec

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
                result[0] = self.model.generate([self.text])
            done.set()

        gen_thread = threading.Thread(target=generate_worker)
        prog_thread = threading.Thread(target=progress_worker)

        gen_thread.start()
        prog_thread.start()

        gen_thread.join()
        done.set()
        prog_thread.join()

        audio_tensor = result[0]
        print("Audio generated! Saving to file...")

        output_path = self.get_next_filename()
        # Remove .wav extension since audio_write adds it
        output_base = output_path.replace('.wav', '')

        for idx, one_wav in enumerate(audio_tensor):
            audio_write(f'{output_base}', one_wav.cpu(), self.model.sample_rate, strategy="loudness", loudness_compressor=True)

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
        print("\n========== SFX Generator ==========")
        print("Model: AudioGen Medium (facebook/audiogen-medium)")
        print("Note: Requires audiocraft library")
        print("Commands:")
        print("  d <sec>    - Set duration (current: {}s)".format(self.duration))
        print("  s <hz>     - Set sampling rate (current: {}Hz)".format(self.sampling_rate))
        print("  t <text>   - Set prompt (current: {})".format(self.text[:30] + "..." if len(self.text) > 30 else self.text))
        print("  p          - Show all parameters")
        print("  g          - Generate SFX")
        print("  h / ?      - Show this help")
        print("  q          - Quit")
        print("===================================")

    def show_compact_status(self):
        short_text = self.text[:20] + "..." if len(self.text) > 20 else self.text
        print(f"[{self.duration}s | {self.sampling_rate}Hz | \"{short_text}\"]")


if __name__ == "__main__":
    generator = SFXGenerator()
    generator.run_menu()
