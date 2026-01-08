# 🚀 How to Start Haven

You will need **4 separate terminal windows** to run the full stack.

### Prerequisites
1. Ensure you are in the project root folder.
2. For backend commands, ensure your virtual environment is activated:
   - Mac/Linux: `source venv/bin/activate`
   - Windows: `.\venv\Scripts\activate`
3. Install requirements
```bash
   cd backend
```
   - Install requirements.txt
```bash
   pip install -r requirements
```
   - Install engines
```bash
   brew bundle
```


---

### 1. Start Infrastructure (Database & Redis)
*Run from the project root `Haven/`*
```bash
docker compose up -d
```

### 2. Start Backend Services
Haven’s backend is composed of **three concurrent services**.  
Each service must run in its **own terminal window**.

First, open **3 separate terminals** and navigate to the backend directory in all of them:

```bash
cd backend
```

1. Terminal A: **The Celery Worker** (The Muscle) Processes images, AI embeddings, and thumbnails.
   
```bash
python -m celery -A app.core.celery_app.celery_app worker --loglevel=info --pool=solo
```

2. Terminal B: **The Celery Beat** (The Sentinel) Runs the 60s automated scan schedule.
   
```bash
python -m celery -A app.core.celery_app.celery_app beat --loglevel=info
```

3. Terminal C: The **API Server** Runs the FastAPI backend.

```bash
uvicorn app.main:app --reload
```

### 3. Start Frontend
Open a new terminal. Navigate to the frontend folder: 

```bash
cd Frontend
```

```bash
npm run dev
```

## 🐳 Docker Cheat Sheet

### Start in foreground (to see logs)
```bash
docker compose up
```

### Start detached (background)
```bash
docker compose up -d
```

### Stop containers
```bash
docker compose down
```

### Stop and wipe all data volumes (Fresh start)
```bash
docker compose down -v
```

### Restart everything
```bash
docker compose restart
```

### View running containers
```bash
docker compose ps
```

### Follow logs (Live tail)
```bash
docker compose logs -f
```

