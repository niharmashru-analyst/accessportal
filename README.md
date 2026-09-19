# Dashboard Access Portal

Central login portal for EKA Analytics and Modern Trade 360.

## Stack
- React + Vite
- Flask
- SQLite
- Render
- GitHub

## Local setup

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
npm run build
```

Then from the project root/backend environment:
```bash
cd backend
python app.py
```

Default development admin:
- Email: admin@example.com
- Password: Admin@123

Change these using environment variables before deployment.

## Render

Connect the GitHub repository to Render and use `render.yaml`, or create a Python Web Service with:

Build:
```bash
cd frontend && npm install && npm run build && cd ../backend && pip install -r requirements.txt
```

Start:
```bash
cd backend && gunicorn app:app --bind 0.0.0.0:$PORT
```

Set:
- ADMIN_EMAIL
- ADMIN_PASSWORD
- SECRET_KEY

The Render persistent disk stores the SQLite database.
