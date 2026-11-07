import urllib.request
import urllib.parse
import json
import re

def clean_song_query(title, artist=""):
    """Limpa títulos do YouTube removendo tags de canal e termos de karaokê"""
    cleaned = title
    # Remover canais conhecidos de karaokê
    channel_tags = [
        r'ponto\s*do\s*karaok[eê](\s*\d+)?',
        r'sing\s*king(\s*karaoke)?',
        r'karafun(\s*karaoke)?',
        r'muramatsu(\s*karaok[eê])?',
        r'vagalume(\s*karaok[eê])?',
        r'karaok[eê]\s*brasil'
    ]
    for tag in channel_tags:
        cleaned = re.sub(rf'\b{tag}\b', '', cleaned, flags=re.IGNORECASE)

    # Remover palavras comuns
    remove_words = [
        r'karaok[eê]', r'karaoke', r'playback', r'instrumental',
        r'com\s*letra', r'with\s*lyrics', r'audio\s*oficial',
        r'clipe\s*oficial', r'hd', r'4k', r'remastered',
        r'oficial', r'official'
    ]
    for w in remove_words:
        cleaned = re.sub(rf'\b{w}\b', '', cleaned, flags=re.IGNORECASE)

    # Limpar pontuação residual
    cleaned = re.sub(r'\(.*?\)', '', cleaned)
    cleaned = re.sub(r'\[.*?\]', '', cleaned)
    cleaned = re.sub(r'\|.*$', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' -_')

    if artist and artist.lower() not in cleaned.lower() and not re.search(rf'\b{artist}\b', cleaned, re.IGNORECASE):
        cleaned = f"{artist} {cleaned}"

    return cleaned.strip()

def fetch_synced_lyrics(title, artist=""):
    """Busca letra sincronizada (LRC) na base do LRCLIB com buscas em cascata"""
    queries = []
    if artist:
        queries.append(f"{artist} {title}")
        queries.append(f"{title} {artist}")
    queries.append(clean_song_query(title, artist))
    queries.append(title)

    seen = set()
    for q in queries:
        q_clean = q.strip()
        if not q_clean or q_clean.lower() in seen:
            continue
        seen.add(q_clean.lower())

        encoded_q = urllib.parse.quote(q_clean)
        url = f"https://lrclib.net/api/search?q={encoded_q}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CaliopeKaraoke/1.0'})
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                for item in data:
                    if item.get("syncedLyrics"):
                        print(f"Letra sincronizada encontrada no LRCLIB: {item.get('artistName')} - {item.get('trackName')}")
                        return parse_lrc(item["syncedLyrics"])
        except Exception as e:
            print(f"Aviso LRCLIB query '{q_clean}': {e}")

    return []

def parse_lrc(lrc_text):
    lines = []
    pattern = r'\[(\d{2}):(\d{2}\.\d{2,3})\](.*)'

    for line in lrc_text.splitlines():
        match = re.match(pattern, line.strip())
        if match:
            mins = int(match.group(1))
            secs = float(match.group(2))
            text = match.group(3).strip()
            total_sec = mins * 60 + secs
            if text:
                lines.append({
                    "start": round(total_sec, 2),
                    "text": text
                })

    for i in range(len(lines)):
        if i < len(lines) - 1:
            lines[i]["end"] = lines[i + 1]["start"]
        else:
            lines[i]["end"] = lines[i]["start"] + 5.0

    return lines

def generate_notes_strictly_from_lyrics(lrc_lines, default_midi=60):
    """
    Quando temos a letra sincronizada oficial:
    Gera as notas EXATAMENTE no tempo em que cada frase/palavra é cantada!
    Zero notas falsas no início ou em solos instrumentais!
    """
    notes = []
    # Escala pentatônica amigável para alternância natural se não houver pitch isolado
    melody_scale = [60, 62, 64, 65, 67, 69, 72] # C4, D4, E4, F4, G4, A4, C5

    scale_idx = 0
    for line in lrc_lines:
        line_start = line["start"]
        line_duration = max(1.2, line["end"] - line["start"])
        words = line["text"].split()
        if not words:
            continue

        # Distribuir as palavras ao longo da duração da frase
        word_dur = min(0.9, (line_duration * 0.85) / len(words))

        for idx, word in enumerate(words):
            start_t = line_start + (idx * word_dur)
            dur = max(0.25, word_dur * 0.9)
            
            # Altura melódica com variação harmônica
            midi = melody_scale[scale_idx % len(melody_scale)]
            scale_idx += 1

            is_golden = (idx == len(words) - 1 and dur >= 0.5)

            notes.append({
                "start": round(start_t, 2),
                "duration": round(dur, 2),
                "midi": midi,
                "text": word + " ",
                "isGolden": is_golden
            })

    return notes

def align_lyrics_to_notes(detected_notes, lrc_lines):
    """
    Filtra notas detectadas para MANTER APENAS as que caem dentro de frases cantadas.
    Se não houver notas suficientes detectadas, usa o gerador sincronizado por sílaba.
    """
    if not lrc_lines:
        return detected_notes

    filtered_notes = []

    for line in lrc_lines:
        line_start = line["start"] - 0.3
        line_end = line["end"]
        words = line["text"].split()
        if not words:
            continue

        # Pega apenas notas dentro deste intervalo
        matching = [n for n in detected_notes if n["start"] >= line_start and n["start"] < line_end and n["midi"] >= 48]

        if len(matching) >= len(words):
            # Há notas suficientes para todas as palavras
            notes_per_word = len(matching) / len(words)
            for idx, note in enumerate(matching):
                w_idx = min(len(words) - 1, int(idx / notes_per_word))
                note["text"] = words[w_idx] + " "
                if idx == len(matching) - 1 and note.get("duration", 0) > 0.4:
                    note["isGolden"] = True
                filtered_notes.append(note)
        else:
            # Há menos notas detectadas do que palavras na frase (ex: cantor cantou rápido ou suave)
            # Usar o pitch médio detectado das notas (ou MIDI 60 se nenhuma) e distribuir todas as palavras no tempo da frase
            base_midi = round(sum(n["midi"] for n in matching) / len(matching)) if matching else 60
            line_span = max(1.0, line_end - line_start)
            word_dur = min(0.75, (line_span * 0.85) / len(words))
            for idx, word in enumerate(words):
                w_start = line_start + (idx * word_dur)
                # Se houver nota detectada perto deste tempo, usar a altura real dela
                nearby = [n for n in matching if abs(n["start"] - w_start) < 0.35]
                midi = nearby[0]["midi"] if nearby else (base_midi + ((idx % 3) - 1))
                filtered_notes.append({
                    "start": round(w_start, 2),
                    "duration": round(max(0.2, word_dur * 0.85), 2),
                    "midi": midi,
                    "text": word + " ",
                    "isGolden": (idx == len(words) - 1)
                })

    return filtered_notes if filtered_notes else generate_notes_strictly_from_lyrics(lrc_lines)
