FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /data

ENV DATABASE_PATH=/data/cards.db
ENV PORT=8000
EXPOSE 8000

# 单进程 + 多线程：SQLite 与内存限流都保持在同一个进程内
CMD ["sh", "-c", "gunicorn server:app --bind 0.0.0.0:${PORT} --workers 1 --threads 8 --timeout 120"]
