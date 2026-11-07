#!/usr/bin/env bash
# ==============================================================================
# CALIOPE - Script de Inicialização do Servidor Local
# ==============================================================================

# Garante que o script roda na pasta do projeto
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Cores no terminal
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}${BOLD}"
echo "  🎤 ========================================================"
echo "                 CALIOPE • VIDEOKÊ OFICIAL                   "
echo "                 Iniciando Servidor Local...                 "
echo "  =========================================================== 🎤"
echo -e "${NC}"

# 1. Verificar se o Python 3 está instalado
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Erro: Python 3 não foi encontrado no seu sistema.${NC}"
    echo "Instale o Python 3 com: sudo apt update && sudo apt install python3"
    exit 1
fi

# 2. Descobrir IP local na rede Wi-Fi para conectar o celular
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n 1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="SEU_IP_LOCAL"
fi

# 3. Liberar a porta 3000 caso já esteja ocupada por uma instância anterior
OCCUPIED=$(fuser 3000/tcp 2>/dev/null)
if [ -n "$OCCUPIED" ]; then
    echo -e "${YELLOW}⚠️  Porta 3000 já estava em uso pelo processo ($OCCUPIED). Reiniciando...${NC}"
    fuser -k 3000/tcp &>/dev/null
    sleep 1
fi

echo -e "${GREEN}${BOLD}✅ Servidor iniciado com sucesso!${NC}\n"
echo -e "   💻 ${BOLD}Acesse no seu Notebook:${NC}"
echo -e "      👉 ${CYAN}${BOLD}http://localhost:3000${NC}\n"

echo -e "   📱 ${BOLD}Acesse no seu Celular (no mesmo Wi-Fi):${NC}"
echo -e "      👉 ${CYAN}${BOLD}http://${LOCAL_IP}:3000${NC}"
echo -e "      👉 Microfone Remoto: ${CYAN}http://${LOCAL_IP}:3000/mic.html${NC}\n"

echo -e "   ✨ ${BOLD}Recursos disponíveis no modo local:${NC}"
echo -e "      • 40 Músicas Oficiais com vídeo e pontuação sincronizada"
echo -e "      • Download e separação automática de qualquer link do YouTube"
echo -e "      • Ranking local permanente salvo no seu computador\n"

echo -e "${YELLOW}Pressione CTRL+C a qualquer momento para encerrar o servidor.${NC}"
echo -e "-------------------------------------------------------------\n"

# 4. Tentar abrir o navegador padrão automaticamente após 1 segundo
(
    sleep 1.2
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000" &>/dev/null
    elif command -v google-chrome &> /dev/null; then
        google-chrome "http://localhost:3000" &>/dev/null
    elif command -v firefox &> /dev/null; then
        firefox "http://localhost:3000" &>/dev/null
    fi
) &

# 5. Executar o servidor Python
exec python3 server.py
