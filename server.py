import http.server
import socketserver
import os
import sys
import json
import uuid
import shutil
import threading
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

PORT = 3000
DIRECTORY = Path(__file__).resolve().parent
SONGS_DIR = DIRECTORY / "songs"
SONGS_DIR.mkdir(exist_ok=True)
RANKINGS_FILE = DIRECTORY / "rankings.json"

DEFAULT_RANKINGS = [
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

class CaliopeServerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        # 1. API: Listar Músicas Importadas
        if parsed.path == '/api/songs':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

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

            self.wfile.write(json.dumps(songs, ensure_ascii=False).encode('utf-8'))
            return

        # 2. API: Listar Ranking de Pontuações
        if parsed.path == '/api/rankings':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            rankings = []
            if RANKINGS_FILE.exists():
                try:
                    with open(RANKINGS_FILE, 'r', encoding='utf-8') as f:
                        rankings = json.load(f)
                except Exception as e:
                    print(f"Erro lendo rankings.json: {e}")

            if not rankings:
                rankings = DEFAULT_RANKINGS

            self.wfile.write(json.dumps(rankings, ensure_ascii=False).encode('utf-8'))
            return

        # 3. API: Consultar Status de um Job
        if parsed.path.startswith('/api/jobs/'):
            job_id = parsed.path.replace('/api/jobs/', '').strip()
            job = JOBS.get(job_id)

            if not job:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'{"error": "Job not found"}')
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(job, ensure_ascii=False).encode('utf-8'))
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
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"success": true, "message": "Ranking limpo com sucesso"}')
            return

        if parsed.path.startswith('/api/songs/'):
            song_id = unquote(parsed.path.replace('/api/songs/', '').strip())
            deleted = self._delete_song(song_id)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "id": song_id, "deletedFromDisk": deleted}, ensure_ascii=False).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)

        # 1. API: Salvar Pontuação no Ranking
        if parsed.path == '/api/rankings':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            try:
                entry = json.loads(body_bytes.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"JSON inválido: {e}"}).encode('utf-8'))
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

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "entry": entry}, ensure_ascii=False).encode('utf-8'))
            return

        # 1. API: Iniciar Importação do YouTube
        if parsed.path == '/api/import-youtube':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            
            try:
                data = json.loads(body_bytes.decode('utf-8'))
                youtube_url = data.get('url', '').strip()
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"JSON inválido: {e}"}).encode('utf-8'))
                return

            if not youtube_url:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "URL do YouTube ausente"}')
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

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"job_id": job_id}).encode('utf-8'))
            return

        # 2. API: Excluir Música do Catálogo
        if parsed.path == '/api/songs/delete':
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode('utf-8'))
                song_id = data.get('id', '').strip()
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"JSON inválido: {e}"}).encode('utf-8'))
                return

            deleted = self._delete_song(song_id)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "id": song_id, "deletedFromDisk": deleted}, ensure_ascii=False).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CaliopeServerHandler) as httpd:
        print(f"🎤 Caliope Servidor rodando em http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")
