# server.py
# pip install fastapi uvicorn argostranslate
import os
import sys
import signal
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import argostranslate.package
import argostranslate.translate

# ─── конфиг ──────────────────────────────────────────────────────────────────

PORT       = 5000
HOST       = '127.0.0.1'

# пути всегда относительно самого server.py, а не cwd
BASE_DIR   = Path(__file__).parent
MODEL_DIR  = BASE_DIR / 'transmodels'
PID_FILE   = BASE_DIR / '.server.pid'
READY_FILE = BASE_DIR / '.server.ready'

MODELS = {
    ('ru', 'en'): MODEL_DIR / 'translate-ru_en-1_9.argosmodel',
    ('en', 'ru'): MODEL_DIR / 'translate-en_ru-1_9.argosmodel',
}

# ─── загрузка моделей ─────────────────────────────────────────────────────────

def load_models() -> None:
    missing = [str(p) for p in MODELS.values() if not p.exists()]
    if missing:
        print(f'[!] Не найдены модели: {", ".join(missing)}', file=sys.stderr)
        sys.exit(1)

    print('Загрузка моделей Argos Translate...')
    for p in MODELS.values():
        argostranslate.package.install_from_path(str(p))

    # прогрев — чтобы первый реальный запрос не тупил
    argostranslate.translate.translate('тест', 'ru', 'en')
    argostranslate.translate.translate('test', 'en', 'ru')
    print('Модели загружены и прогреты.')

# ─── pid файлы ────────────────────────────────────────────────────────────────

def write_pid_files() -> None:
    pid = os.getpid()
    PID_FILE.write_text(str(pid))
    READY_FILE.write_text(str(pid))
    print(f'Сервер готов! PID {pid}')

def cleanup_pid_files() -> None:
    PID_FILE.unlink(missing_ok=True)
    READY_FILE.unlink(missing_ok=True)

# ─── приложение ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    write_pid_files()
    yield
    cleanup_pid_files()
    print('Пока!')

app = FastAPI(lifespan=lifespan)

class TranslateRequest(BaseModel):
    text: str
    source: str = 'ru'
    target: str = 'en'

@app.post('/translate')
async def translate(req: TranslateRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail='Пустой текст')

    pair = (req.source, req.target)
    if pair not in MODELS:
        raise HTTPException(
            status_code=400,
            detail=f'Языковая пара не поддерживается: {req.source} → {req.target}'
        )

    try:
        # argostranslate синхронный — запускаем в пуле потоков чтобы не блокировать event loop
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: argostranslate.translate.translate(text, req.source, req.target)
        )
        return {'translatedText': result}
    except Exception as e:
        print(f'[!] Ошибка перевода: {e}', file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/health')
async def health():
    return {'status': 'ok'}

# ─── запуск ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    load_models()

    def handle_signal(sig, frame):
        pass
    signal.signal(signal.SIGINT, handle_signal)

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level='error',
        access_log=False,
    )