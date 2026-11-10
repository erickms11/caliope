import http.server
import socketserver
import os
import sys
import json
import uuid
import shutil
import threading
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

PORT = 3000
DIRECTORY = Path(__file__).resolve().parent
SONGS_DIR = DIRECTORY / "songs"
SONGS_DIR.mkdir(exist_ok=True)
RANKINGS_FILE = DIRECTORY / "rankings.json"

DEFAULT_RANKINGS = [
    {
        "id": "mw5pihvqptq7",
        "singer": "Erick Moraes",
        "songTitle": "Te Esperando",
        "songArtist": "Luan Santana",
        "songId": "__Te_Esperando_Luan_Santana_3nBAoA",
        "score": 8850,
        "accuracy": 85,
        "maxCombo": 72,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T01:10:29.126Z"
    },
    {
        "id": "mw5mdji05luw",
        "singer": "Erick Moraes",
        "songTitle": "Angels",
        "songArtist": "Robbie Williams",
        "songId": "Robbie_Williams_Angels_pGFEj-",
        "score": 8366,
        "accuracy": 84,
        "maxCombo": 49,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-06T23:42:39.096Z"
    },
    {
        "id": "mw5ny7rr5hc1",
        "singer": "Erick Moraes",
        "songTitle": "Like A Stone",
        "songArtist": "Audioslave",
        "songId": "CC_Karaoke_X_Audioslave___Like_A_Stone_WjHMQZ",
        "score": 7964,
        "accuracy": 82,
        "maxCombo": 23,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:26:43.287Z"
    },
    {
        "id": "mw5n7knz5cs4",
        "singer": "Erick Moraes",
        "songTitle": "Minha Estrela Perdida",
        "songArtist": "João Paulo e Daniel",
        "songId": "Jo_o_Paulo_e_Daniel_Minha_Estrela_Perdida_BvTDeE",
        "score": 7482,
        "accuracy": 82,
        "maxCombo": 27,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:06:00.287Z"
    },
    {
        "id": "mw5o551e5pir",
        "singer": "Erick Moraes",
        "songTitle": "Talking To The Moon",
        "songArtist": "Bruno Mars",
        "songId": "Bruno_Mars_Talking_To_The_Moon_-_Version_from_kdtWMj",
        "score": 7231,
        "accuracy": 85,
        "maxCombo": 38,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:32:06.338Z"
    },
    {
        "id": "mw5p7pliojsc",
        "singer": "Erick Moraes",
        "songTitle": "Just Give Me A Reason",
        "songArtist": "P!nk ft. Nate Ruess",
        "songId": "Just_Give_Me_A_Reason_Pink_Ft__Nate_ruess_7YSYFT",
        "score": 6567,
        "accuracy": 83,
        "maxCombo": 27,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T01:02:05.910Z"
    },
    {
        "id": "mw5oogwd32tu",
        "singer": "Erick Moraes",
        "songTitle": "Caça e Caçador",
        "songArtist": "Fábio Jr.",
        "songId": "__Ca_a_e_Ca_ador_F_bio_Jr__8fm8rn",
        "score": 5231,
        "accuracy": 82,
        "maxCombo": 26,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:47:08.173Z"
    },
    {
        "id": "mw5oimrzie81",
        "singer": "Erick Moraes",
        "songTitle": "How Deep Is Your Love",
        "songArtist": "Take That",
        "songId": "Take_That_How_Deep_Is_Your_Love_-_from_Zoom_iXYKvk",
        "score": 4350,
        "accuracy": 82,
        "maxCombo": 20,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:42:35.855Z"
    },
    {
        "id": "mw5p0eio2y6y",
        "singer": "Erick Moraes",
        "songTitle": "Dois Rios",
        "songArtist": "Skank",
        "songId": "SKANK_DOIS_RIOS_NSve9N",
        "score": 4044,
        "accuracy": 82,
        "maxCombo": 19,
        "stars": 4,
        "rank": "A",
        "difficulty": "Médio",
        "difficultyId": "medium",
        "date": "2026-11-07T00:56:24.960Z"
    }
]

# Inicializa rankings.json com os recordes padrão se não existir
if not RANKINGS_FILE.exists():
    try:
        with open(RANKINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_RANKINGS, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro inicializando rankings.json: {e}")

# Armazenamento em memória de tarefas de importação em andamento
JOBS = {}

class RangeFileWrapper:
    """Wrapper para enviar apenas o intervalo de bytes solicitado (HTTP Range / 206)."""
    def __init__(self, f, length):
        self.f = f
        self.remaining = length

    def read(self, size=-1):
        if self.remaining <= 0:
            return b''
        if size < 0 or size > self.remaining:
            size = self.remaining
        data = self.f.read(size)
        self.remaining -= len(data)
        return data

    def close(self):
        self.f.close()

class CaliopeServerHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def send_head(self):
        """Sobrescreve send_head para suportar streaming de vídeo/áudio e HTTP Range (206 Partial Content)."""
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            for index in ("index.html", "index.htm"):
                index_path = os.path.join(path, index)
                if os.path.exists(index_path):
                    path = index_path
                    break
            else:
                return super().send_head()

        if not os.path.isfile(path):
            self.send_error(404, "File not found")
            return None

        ctype = self.guess_type(path)
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        total_size = fs[6]
        range_header = self.headers.get('Range')

        is_media = any(path.endswith(ext) for ext in ('.mp4', '.mp3', '.webm', '.wav', '.ogg', '.m4a'))
        is_static_asset = any(path.endswith(ext) for ext in ('.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff2', '.woff', '.ttf', '.ico'))

        if not range_header:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(total_size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD")
            self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Origin")
            self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")

            if is_media or is_static_asset:
                self.send_header("Cache-Control", "public, max-age=604800, immutable")
            else:
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")

            super().end_headers()
            return f

        # Tratar requisição com Range: bytes=start-end
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        if not range_match:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{total_size}")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()
            f.close()
            return None

        start = int(range_match.group(1))
        end = int(range_match.group(2)) if range_match.group(2) else total_size - 1

        if start >= total_size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{total_size}")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()
            f.close()
            return None

        end = min(end, total_size - 1)
        length = end - start + 1

        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{total_size}")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Origin")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
        self.send_header("Cache-Control", "public, max-age=86400")
        super().end_headers()

        f.seek(start)
        return RangeFileWrapper(f, length)

    def send_json_response(self, data, status=200):
        if isinstance(data, (dict, list)):
            payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        elif isinstance(data, str):
            payload = data.encode('utf-8')
        elif isinstance(data, bytes):
            payload = data
        else:
            payload = str(data).encode('utf-8')

        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)

        # 1. API: Listar Músicas Importadas
        if parsed.path == '/api/songs':
            songs = []
            for folder in SONGS_DIR.iterdir():
                if folder.is_dir():
                    json_file = folder / "song.json"
                    if json_file.exists():
                        try:
                            with open(json_file, 'r', encoding='utf-8') as f:
                                songs.append(json.load(f))
                        except Exception as e:
                            print(f"Erro lendo {json_file}: {e}")

            self.send_json_response(songs)
            return

        # 2. API: Listar Ranking de Pontuações
        if parsed.path == '/api/rankings':
            rankings = []
            if RANKINGS_FILE.exists():
                try:
                    with open(RANKINGS_FILE, 'r', encoding='utf-8') as f:
                        rankings = json.load(f)
                except Exception as e:
                    print(f"Erro lendo rankings.json: {e}")

            if not rankings:
                rankings = DEFAULT_RANKINGS

            self.send_json_response(rankings)
            return

        # 3. API: Consultar Status de um Job
        if parsed.path.startswith('/api/jobs/'):
            job_id = parsed.path.replace('/api/jobs/', '').strip()
            job = JOBS.get(job_id)

            if not job:
                self.send_json_response({"error": "Job not found"}, status=404)
                return

            self.send_json_response(job)
            return

        # 4. Servir arquivos de áudio e estáticos normais
        super().do_GET()

    def do_DELETE(self):
        parsed = urlparse(self.path)

        if parsed.path == '/api/rankings':
            if RANKINGS_FILE.exists():
                try:
                    RANKINGS_FILE.unlink()
                except Exception as e:
                    print(f"Erro limpando rankings.json: {e}")
            self.send_json_response({"success": True, "message": "Ranking limpo com sucesso"})
            return

        if parsed.path.startswith('/api/songs/'):
            song_id = unquote(parsed.path.replace('/api/songs/', '').strip())
            deleted = self._delete_song(song_id)
            self.send_json_response({"success": True, "id": song_id, "deletedFromDisk": deleted})
            return

        self.send_json_response({"error": "Endpoint não encontrado"}, status=404)

    def do_POST(self):
        parsed = urlparse(self.path)

        # 1. API: Salvar Pontuação no Ranking
        if parsed.path == '/api/rankings':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            try:
                entry = json.loads(body_bytes.decode('utf-8'))
            except Exception as e:
                self.send_json_response({"error": f"JSON inválido: {e}"}, status=400)
                return

            if not entry.get('singer'):
                entry['singer'] = 'Cantor(a)'
            if not entry.get('id'):
                entry['id'] = str(uuid.uuid4())[:8]

            rankings = []
            if RANKINGS_FILE.exists():
                try:
                    with open(RANKINGS_FILE, 'r', encoding='utf-8') as f:
                        rankings = json.load(f)
                except Exception:
                    rankings = []

            rankings.append(entry)
            rankings.sort(key=lambda r: r.get('score', 0), reverse=True)

            try:
                with open(RANKINGS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(rankings, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Erro salvando rankings.json: {e}")

            self.send_json_response({"success": True, "entry": entry})
            return

        # 2. API: Iniciar Importação do YouTube
        if parsed.path == '/api/import-youtube':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            
            try:
                data = json.loads(body_bytes.decode('utf-8'))
                youtube_url = data.get('url', '').strip()
            except Exception as e:
                self.send_json_response({"error": f"JSON inválido: {e}"}, status=400)
                return

            if not youtube_url:
                self.send_json_response({"error": "URL do YouTube ausente"}, status=400)
                return

            job_id = str(uuid.uuid4())[:8]
            JOBS[job_id] = {
                "id": job_id,
                "status": "starting",
                "progress": 5,
                "message": "Iniciando download...",
                "song": None,
                "error": None
            }

            # Iniciar processador em thread de background
            t = threading.Thread(target=self._run_processor, args=(job_id, youtube_url), daemon=True)
            t.start()

            self.send_json_response({"job_id": job_id})
            return

        # 3. API: Excluir Música do Catálogo
        if parsed.path == '/api/songs/delete':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode('utf-8'))
                song_id = data.get('id', '').strip()
            except Exception as e:
                self.send_json_response({"error": f"JSON inválido: {e}"}, status=400)
                return

            if not song_id:
                self.send_json_response({"error": "ID da música não informado"}, status=400)
                return

            deleted = self._delete_song(song_id)
            self.send_json_response({"success": True, "id": song_id, "deletedFromDisk": deleted})
            return

        self.send_json_response({"error": "Endpoint não encontrado"}, status=404)

    def _delete_song(self, song_id):
        if not song_id:
            return False

        deleted = False
        for folder in SONGS_DIR.iterdir():
            if folder.is_dir():
                # Comparar nome da pasta diretamente
                if folder.name == song_id:
                    try:
                        shutil.rmtree(folder)
                        deleted = True
                        print(f"🗑️ Música excluída: {folder.name}")
                        break
                    except Exception as e:
                        print(f"Erro removendo pasta {folder}: {e}")

                # Ou verificar o ID dentro de song.json
                json_file = folder / "song.json"
                if json_file.exists():
                    try:
                        with open(json_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('id') == song_id:
                                shutil.rmtree(folder)
                                deleted = True
                                print(f"🗑️ Música excluída: {data.get('title')} ({folder.name})")
                                break
                    except Exception as e:
                        print(f"Erro checando {json_file}: {e}")

        return deleted

    def _run_processor(self, job_id, url):
        import importlib
        import processor
        import lyrics
        importlib.reload(lyrics)
        importlib.reload(processor)

        def on_progress(step, pct, msg):
            if job_id in JOBS:
                JOBS[job_id]["status"] = step
                JOBS[job_id]["progress"] = pct
                JOBS[job_id]["message"] = msg

        try:
            song_data = processor.process_youtube_song(url, progress_callback=on_progress)
            JOBS[job_id]["status"] = "done"
            JOBS[job_id]["progress"] = 100
            JOBS[job_id]["message"] = "Música pronta!"
            JOBS[job_id]["song"] = song_data
        except Exception as e:
            print(f"Erro processando YouTube ({url}): {e}")
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = str(e)
            JOBS[job_id]["message"] = f"Falha ao processar: {e}"

if __name__ == "__main__":
    os.chdir(str(DIRECTORY))
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", PORT), CaliopeServerHandler) as httpd:
        print(f"🎤 Caliope Servidor rodando em http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
