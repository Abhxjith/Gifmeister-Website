from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont
import tempfile
import whisper
import math

app = Flask(__name__)
CORS(app)

# Use absolute paths to avoid any path resolution issues
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
GIF_FOLDER = os.path.join(BASE_DIR, "gifs")

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GIF_FOLDER, exist_ok=True)

# Load Whisper model
model = whisper.load_model("base")

def transcribe_audio_from_video(input_video):
    """Transcribe audio from video using Whisper and return segments with timestamps"""
    audio_path = input_video.replace(".mp4", ".wav")
    subprocess.run([
        "ffmpeg", "-i", input_video, "-q:a", "0", "-map", "a", audio_path
    ], check=True)
    
    result = model.transcribe(audio_path, word_timestamps=True)
    os.remove(audio_path)
    return result

def get_sentence_segments(transcript_data):
    """Extract segments based on sentence boundaries"""
    if not transcript_data or 'segments' not in transcript_data:
        return []
    
    sentence_segments = []
    current_sentence = {
        'text': '',
        'start': None,
        'end': None,
        'words': []
    }
    
    for segment in transcript_data['segments']:
        # Process each word to detect sentence boundaries
        if 'words' in segment:
            for word in segment['words']:
                word_text = word['word'].strip()
                
                # Initialize start time for new sentence
                if current_sentence['start'] is None:
                    current_sentence['start'] = word['start']
                
                current_sentence['text'] += ' ' + word_text
                current_sentence['words'].append(word)
                current_sentence['end'] = word['end']
                
                # Check for sentence end (period)
                if word_text.endswith('.'):
                    # Clean up the sentence
                    current_sentence['text'] = current_sentence['text'].strip()
                    if current_sentence['text']:
                        sentence_segments.append(current_sentence)
                    
                    # Start new sentence
                    current_sentence = {
                        'text': '',
                        'start': None,
                        'end': None,
                        'words': []
                    }
    
    # Add any remaining text as a sentence
    if current_sentence['text'].strip():
        sentence_segments.append(current_sentence)
    
    return sentence_segments

def create_gif(input_video, output_gif, start_time, duration, caption=None, max_text_width=350):
    """Create a fun GIF with bold bouncing text, adjusting text size based on the length"""
    with tempfile.TemporaryDirectory() as temp_dir:
        if caption:
            # Escape single quotes in the caption
            caption = caption.replace("'", "'\\''")
            
            # List of fun colors to cycle through
            colors = ['#FF1493', '#00FF00', '#FFD700', '#FF4500', '#00FFFF']  # pink, lime, gold, orange, cyan
            color = colors[hash(caption) % len(colors)]  # Pick a color based on text
            
            # Calculate font size based on the length of the caption
            base_font_size = 50  # Default font size
            text_width = len(caption) * base_font_size * 0.6  # Estimate width of text (approximation)
            font_size = base_font_size * (max_text_width / text_width) if text_width > max_text_width else base_font_size
            
            # Split the caption into lines if it's too long (basic approach)
            # Adjust this to make the lines wrap better if needed
            if text_width > max_text_width:
                caption = '\n'.join([caption[i:i+30] for i in range(0, len(caption), 30)])  # Split into 30-char lines

            subprocess.run([
                "ffmpeg", "-i", input_video,
                "-ss", str(start_time),
                "-t", str(duration),
                "-vf",
                f"fps=10,"
                f"scale=320:-1,"
                f"eq=saturation=1.2:contrast=1.1,"  # Slightly enhanced colors
                # Single bouncing text with bold style
                f"drawtext="
                f"text='{caption}': "
                f"fontfile=/usr/share/fonts/truetype/impact/impact.ttf: "
                f"fontsize={int(font_size)}: "  # Dynamically set font size
                f"fontcolor={color}: "
                f"y=h-h/4+sin(t*3)*h/16: "  # Gentler bounce
                f"x=(w-text_w)/2: "
                f"borderw=6: "  # Thicker border for more boldness
                f"bordercolor=white",
                f"{temp_dir}/frame%04d.png"
            ], check=True)
        else:
            # Extract frames with slightly enhanced colors
            subprocess.run([
                "ffmpeg", "-i", input_video,
                "-ss", str(start_time),
                "-t", str(duration),
                "-vf", "fps=10,scale=320:-1,eq=saturation=1.2:contrast=1.1",
                f"{temp_dir}/frame%04d.png"
            ], check=True)

        # Create the GIF with good quality settings
        subprocess.run([
            "ffmpeg", "-i", f"{temp_dir}/frame%04d.png",
            "-vf",
            "fps=10,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=floyd_steinberg",
            "-loop", "0",
            output_gif
        ], check=True)

@app.route("/upload_video", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video = request.files["video"]
    if not video.filename:
        return jsonify({"error": "No selected file"}), 400
        
    # Ensure filename is secure
    from werkzeug.utils import secure_filename
    filename = secure_filename(video.filename)
    
    video_path = os.path.join(UPLOAD_FOLDER, filename)
    video.save(video_path)

    try:
        # Get video duration
        duration_str = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", video_path
        ]).decode().strip()
        
        total_duration = float(duration_str)
        
        output_prefix = os.path.splitext(filename)[0]
        clip_folder = os.path.join(GIF_FOLDER, output_prefix)
        os.makedirs(clip_folder, exist_ok=True)
        
        # Get transcript with timestamps
        transcript_data = transcribe_audio_from_video(video_path)
        
        # Get sentence-based segments
        sentence_segments = get_sentence_segments(transcript_data)
        
        output_gifs = []
        
        # Process each sentence segment
        for i, segment in enumerate(sentence_segments):
            gif_name = f"segment_{i}.gif"
            gif_path = os.path.join(clip_folder, gif_name)
            
            # Calculate duration for this segment
            duration = segment['end'] - segment['start']
            
            # Add small padding to avoid cutting off words
            start_time = max(0, segment['start'] - 0.2)
            duration = min(duration + 0.4, total_duration - start_time)
            
            print(f"Processing segment {i}: Caption = {segment['text']}")  # Debug log

            create_gif(
                video_path,
                gif_path,
                start_time,
                duration,
                segment['text'].replace('.', '')  # Remove periods or dots from the caption
            )
            
            # Store relative path from GIF_FOLDER
            relative_path = os.path.join(output_prefix, gif_name)
            gif_data = {
                "path": f"/gifs/{relative_path}",  # URL path
                "start_time": start_time,
                "end_time": start_time + duration,
                "caption": segment['text'].replace('.', '')  # Remove periods or dots from the caption
            }
            
            output_gifs.append(gif_data)
    
    except Exception as e:
        print(f"Error processing video: {str(e)}")
        return jsonify({"error": f"Failed to process video: {str(e)}"}), 500
    
    finally:
        # Clean up the video file
        if os.path.exists(video_path):
            os.remove(video_path)
    
    return jsonify({
        "gifs": output_gifs,
        "total_duration": total_duration
    }), 200

@app.route("/gifs/<path:filename>")
def serve_gif(filename):
    """Serve GIF files with proper path handling"""
    try:
        # Construct the full path to the GIF
        full_path = os.path.join(GIF_FOLDER, filename)
        
        # Get the directory containing the requested file
        directory = os.path.dirname(full_path)
        
        # Get just the filename without the path
        basename = os.path.basename(full_path)
        
        # Check if the file exists
        if not os.path.exists(full_path):
            return jsonify({"error": "GIF not found"}), 404
        
        return send_from_directory(directory, basename)
    except Exception as e:
        return jsonify({"error": f"Error serving GIF: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)
