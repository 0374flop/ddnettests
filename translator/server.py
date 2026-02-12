# server.py ДЛЯ СПРАВКИ ПИТОН ПИСАЛ НЕ Я А ИИ, тут надо кстати "pip install flask argostranslate requests"
from flask import Flask, request, jsonify
import os
import argostranslate.package
import argostranslate.translate
import threading
import time
import requests

app = Flask(__name__)

ru_en_path = "transmodels/translate-ru_en-1_9.argosmodel"
en_ru_path = "transmodels/translate-en_ru-1_9.argosmodel"
PID_FILE = ".server.pid"
READY_FILE = ".server.ready"

def write_ready():
    pid = os.getpid()
    with open(PID_FILE, "w") as f: f.write(str(pid))
    with open(READY_FILE, "w") as f: f.write(str(pid))
    print(f"Сервер полностью готов! PID {pid}")

print("Загрузка моделей Argos Translate...")
for path in (ru_en_path, en_ru_path):
    if os.path.exists(path):
        argostranslate.package.install_from_path(path)

argostranslate.translate.translate("тест", "ru", "en")
argostranslate.translate.translate("test", "en", "ru")
print("Модели загружены в память")

@app.route("/translate", methods=["POST"])
def translate():
    try:
        data = request.get_json(force=True)
        text = data.get("text", "").strip()
        source = data.get("source", "ru")
        target = data.get("target", "en")
        if not text:
            return jsonify({"error": "Пустой текст"}), 400
        result = argostranslate.translate.translate(text, source, target)
        return jsonify({"translatedText": result})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    threading.Thread(target=app.run, kwargs={
        "host": "127.0.0.1", "port": 5000, "threaded": True
    }, daemon=True).start()

    print("Ожидание запуска Flask...")
    for _ in range(50):
        try:
            r = requests.get("http://127.0.0.1:5000/", timeout=0.5)
            if r.status_code == 404:
                write_ready()
                break
        except:
            time.sleep(0.5)
    else:
        print("Не удалось поднять Flask")
        exit(1)

    print("Сервер работает! Нажми Ctrl+C для остановки")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Пока!")