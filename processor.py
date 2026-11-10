import os
import sys
import json
import re
import subprocess
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SONGS_DIR = BASE_DIR / "songs"
SONGS_DIR.mkdir(exist_ok=True)
YT_DLP_BIN = BASE_DIR / "bin" / "yt-dlp"

def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {' '.join(cmd)}\n{res.stderr}")
    return res

def clean_karaoke_title(raw_title, raw_artist=""):
    """
    Remove tags de canais de Karaokê do YouTube e extrai Título e Artista limpos
    Ex: 'Ponto do Karaokê 2 Dois Amores, Duas Paixões' -> ('Dois Amores, Duas Paixões', 'Calcinha Preta')
        'Bruno & Marrone - Bijuteria (Karaokê Oficial)' -> ('Bijuteria', 'Bruno & Marrone')
        'It Will Rain by Bruno Mars - Karaoke with BACKING VOCALS' -> ('It Will Rain', 'Bruno Mars')
    """
    clean = raw_title
    channel_tags = [
        r'ponto\s*do\s*karaok[eê](\s*\d+)?',
        r'sing\s*king(\s*karaoke)?',
        r'karafun(\s*karaoke)?',
        r'muramatsu(\s*karaok[eê])?',
        r'vagalume(\s*karaok[eê])?',
        r'karaok[eê]\s*brasil',
        r'kbkaraoke',
    ]
    for tag in channel_tags:
        clean = re.sub(tag, '', clean, flags=re.IGNORECASE)

    clean = re.sub(r'\(.*?\)', '', clean)
    clean = re.sub(r'\[.*?\]', '', clean)
    clean = re.sub(r'\|.*$', '', clean)

    phrases = [
        r'karaoke\s+with\s+backing\s+vocals?',
        r'with\s+backing\s+vocals?',
        r'backing\s+vocals?',
        r'vocal\s+guide',
        r'guide\s+melody',
        r'vers[aã]o\s+karaok[eê]',
        r'karaoke\s+version',
        r'com\s+letra',
        r'with\s+lyrics',
        r'karaok[eê]',
        r'karaoke',
        r'playback',
        r'instrumental',
        r'remastered',
        r'oficial',
        r'official',
        r'hd',
        r'4k',
        r'hq'
    ]
    for p in phrases:
        clean = re.sub(rf'\b{p}\b', '', clean, flags=re.IGNORECASE)

    clean = re.sub(r'\s+', ' ', clean).strip(' -_–|')

    artist = ""
    title = clean

    # Check for "Song by Artist"
    if re.search(r'\s+by\s+', clean, flags=re.IGNORECASE):
        parts = re.split(r'\s+by\s+', clean, flags=re.IGNORECASE, maxsplit=1)
        title = parts[0].strip(' -_–|')
        artist = parts[1].strip(' -_–|')
    elif " - " in clean or " – " in clean:
        delimiter = " - " if " - " in clean else " – "
        parts = clean.split(delimiter, 1)
        p0 = parts[0].strip(' -_–|')
        p1 = parts[1].strip(' -_–|')
        # Heurística: se raw_artist corresponder a p1, o formato original era "Música - Artista"
        if raw_artist and (raw_artist.lower() in p1.lower()) and (raw_artist.lower() not in p0.lower()):
            title = p0
            artist = p1
        else:
            artist = p0
            title = p1

    title = title.strip(' "\'“”–-')
    artist = artist.strip(' "\'“”–-')
    if not artist and raw_artist:
        artist = raw_artist.strip(' "\'“”–-')

    return title, artist

def process_youtube_song(youtube_url, progress_callback=None):
    """
    Pipeline Videokê YouTube:
    Baixa o vídeo de karaokê (com áudio instrumental de estúdio e letra original no vídeo),
    otimizado para execução instantânea no navegador e pontuação em tempo real pelo microfone.
    """
    def report(step, pct, msg):
        print(f"[{pct}%] {msg}")
        if progress_callback:
            progress_callback(step, pct, msg)

    report("downloading", 15, "Obtendo dados do vídeo de Karaokê...")

    cmd_info = [
        str(YT_DLP_BIN),
        "--dump-json",
        "--no-playlist",
        "--extractor-args", "youtube:player_client=android,web",
        youtube_url
    ]
    info_res = run_cmd(cmd_info)
    info = json.loads(info_res.stdout)

    video_id = info.get("id")
    raw_title = info.get("title", "Karaokê")
    raw_artist = info.get("artist") or info.get("uploader") or info.get("channel", "")
    duration = info.get("duration", 180)
    thumbnail = info.get("thumbnail")

    title, artist = clean_karaoke_title(raw_title, raw_artist)
    safe_folder = re.sub(r'[^a-zA-Z0-9_\-]', '_', f"{artist}_{title}")[:45] + f"_{video_id[:6]}"
    song_dir = SONGS_DIR / safe_folder
    song_dir.mkdir(parents=True, exist_ok=True)

    video_file = song_dir / "video.mp4"

    report("downloading", 45, f"Baixando vídeo leve com letra de: {title}...")
    cmd_dl = [
        str(YT_DLP_BIN),
        "--extractor-args", "youtube:player_client=android,web",
        "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best[height<=480]/18/best",
        "--merge-output-format", "mp4",
        "-o", str(video_file),
        "--no-playlist",
        youtube_url
    ]
    run_cmd(cmd_dl)

    # Salvar thumbnail local em WebP otimizado (rápido e leve)
    local_thumb_rel = f"songs/{safe_folder}/thumbnail.webp"
    thumb_saved = False
    temp_thumb = song_dir / "temp_thumb.tmp"

    if thumbnail and str(thumbnail).startswith("http"):
        try:
            req = urllib.request.Request(thumbnail, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    with open(temp_thumb, "wb") as f_out:
                        f_out.write(resp.read())
            cmd_conv = [
                "ffmpeg", "-y", "-i", str(temp_thumb),
                "-vf", "scale=480:-1", "-q:v", "78",
                str(song_dir / "thumbnail.webp")
            ]
            run_cmd(cmd_conv, check=False)
            if (song_dir / "thumbnail.webp").exists() and (song_dir / "thumbnail.webp").stat().st_size > 500:
                thumb_saved = True
        except Exception:
            pass
        finally:
            if temp_thumb.exists():
                temp_thumb.unlink()

    # Fallback: se não salvou via URL, extrai frame do próprio vídeo baixado
    if not thumb_saved and video_file.exists():
        try:
            cmd_extract = [
                "ffmpeg", "-y", "-ss", "00:00:05", "-i", str(video_file),
                "-vframes", "1", "-vf", "scale=480:-1", "-q:v", "78",
                str(song_dir / "thumbnail.webp")
            ]
            run_cmd(cmd_extract, check=False)
            if (song_dir / "thumbnail.webp").exists() and (song_dir / "thumbnail.webp").stat().st_size > 500:
                thumb_saved = True
        except Exception:
            pass

    final_thumb = local_thumb_rel if thumb_saved else (thumbnail or "")

    # Detecção automática de categoria (Nacional vs Internacional)
    common_en = {'the', 'you', 'love', 'me', 'my', 'and', 'for', 'to', 'in', 'of', 'it', 'on', 'with', 'all', 'like', 'feat', 'ft'}
    words = set(re.findall(r'[a-zA-Z]+', f"{title} {artist}".lower()))
    is_international = len(words.intersection(common_en)) >= 2
    category = "internacional" if is_international else "nacional"

    report("finalizing", 85, "Registrando no catálogo do Videokê...")
    song_data = {
        "id": safe_folder,
        "title": title,
        "artist": artist if artist else "Karaokê",
        "genre": "Videokê Oficial",
        "category": category,
        "difficulty": "Dinâmica",
        "bpm": 120,
        "duration": round(duration, 1),
        "thumbnail": final_thumb,
        "videoUrl": f"songs/{safe_folder}/video.mp4",
        "audioUrl": f"songs/{safe_folder}/video.mp4",
        "hasVideoLyrics": True,
        "notes": []
    }

    with open(song_dir / "song.json", "w", encoding="utf-8") as f:
        json.dump(song_data, f, ensure_ascii=False, indent=2)

    report("done", 100, f"🎉 {title} pronta para cantar no Videokê!")
    return song_data

if __name__ == "__main__":
    if len(sys.argv) > 1:
        process_youtube_song(sys.argv[1])
    else:
        print("Uso: python3 processor.py <YOUTUBE_URL>")
