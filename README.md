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


## IMPORTANT: Render persistent storage

This app uses SQLite. For users to survive redeploys/restarts, the Render Web Service must have a persistent disk mounted at:

`/var/data`

If your existing Render service was created manually, open Render → Service → Disks and add a persistent disk:
- Name: `portal-data`
- Mount Path: `/var/data`
- Size: 1 GB

If your Render plan does not support persistent disks, the app will still run using its fallback database, but users/passwords can be lost after a restart/redeploy. For a real production user database, use a persistent disk or an external PostgreSQL database later.

## Required environment variables

`ADMIN_EMAIL` = your admin email  
`ADMIN_PASSWORD` = your admin password  
`SECRET_KEY` = Render-generated secret  
`EKA_URL` = https://eka-ughi.onrender.com  
`MT_URL` = https://mt360db.onrender.com  
`DB_PATH` = /var/data/portal.db
