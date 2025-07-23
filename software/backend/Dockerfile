FROM python:3.9-slim-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential portaudio19-dev libgl1-mesa-glx curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip uninstall -y psycopg2 psycopg2-binary || true && pip install --no-cache-dir -r requirements.txt && pip install asyncpg && pip check

COPY . /app

CMD ["uvicorn", "software.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]