# GlucoMind Deployment Guide

This guide will help you deploy the GlucoMind application to production.

## 📋 Prerequisites

- Node.js 16+ and npm
- Python 3.8+
- MongoDB (local or MongoDB Atlas)
- Git

## 🗂️ Project Structure

```
glucomind/
├── backend/          # Node.js Express API
├── frontend/         # React + Vite SPA
└── ml-service/       # Python FastAPI ML microservice
```

## ⚙️ Environment Configuration

### 1. Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```bash
# Production Settings
PORT=5001
NODE_ENV=production

# Database - Use MongoDB Atlas for production
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/glucomind

# Security - Generate a strong secret
JWT_SECRET=$(openssl rand -base64 64)

# ML Service URL (update for production)
ML_SERVICE_URL=http://localhost:8000
```

### 2. Frontend Configuration

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```bash
# Production API URLs
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_ML_SERVICE_URL=https://ml.yourdomain.com

# App Configuration
VITE_APP_NAME=GlucoMind
VITE_APP_VERSION=1.0.0
```

### 3. ML Service Configuration

```bash
cd ml-service
cp .env.example .env
```

Edit `ml-service/.env`:

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
WORKERS=4  # Set to number of CPU cores

# CORS - Restrict to your domain
CORS_ORIGINS=["https://yourdomain.com"]

# Environment
ENVIRONMENT=production
```

## 🚀 Deployment Steps

### Step 1: Install Dependencies

#### Backend
```bash
cd backend
npm install --production
```

#### Frontend
```bash
cd frontend
npm install
```

#### ML Service
```bash
cd ml-service
pip install -r requirements.txt
```

### Step 2: Train ML Model (First Time Only)

```bash
cd ml-service
python generate_dataset.py
python train_model.py
```

This will create:
- `data/diabetes_dataset.csv`
- `models/glucose_predictor.joblib`
- `models/model_metadata.json`

### Step 3: Build Frontend for Production

```bash
cd frontend
npm run build
```

This creates an optimized build in `frontend/dist/`

### Step 4: Start Services

#### Option A: Manual Start (Development/Testing)

**Terminal 1 - Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 - ML Service:**
```bash
cd ml-service
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

**Terminal 3 - Frontend (for development):**
```bash
cd frontend
npm run dev
```

OR serve the built frontend with a static server:
```bash
cd frontend/dist
npx serve -s . -p 3000
```

#### Option B: Using PM2 (Production)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [
    {
      name: 'glucomind-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

Start services:
```bash
# Backend
pm2 start ecosystem.config.js

# ML Service
cd ml-service
pm2 start "uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4" --name glucomind-ml

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🌐 Production Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

1. **Setup Nginx as reverse proxy:**

```nginx
# /etc/nginx/sites-available/glucomind

# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        root /path/to/glucomind/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# ML Service
server {
    listen 80;
    server_name ml.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

2. **Enable HTTPS with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d ml.yourdomain.com
```

### Option 2: Docker Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5001:5001"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - JWT_SECRET=${JWT_SECRET}
      - ML_SERVICE_URL=http://ml-service:8000
    depends_on:
      - mongodb
  
  ml-service:
    build: ./ml-service
    ports:
      - "8000:8000"
    volumes:
      - ./ml-service/models:/app/models
  
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
  
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### Option 3: Cloud Platforms

#### Vercel (Frontend only)
```bash
cd frontend
npm install -g vercel
vercel --prod
```

#### Railway / Render (Full stack)
- Push to GitHub
- Connect repository to Railway/Render
- Set environment variables in dashboard
- Deploy each service

#### AWS / Google Cloud / Azure
- Use managed services:
  - Frontend: S3 + CloudFront / Cloud Storage
  - Backend: ECS / Cloud Run / App Service
  - Database: MongoDB Atlas / DocumentDB
  - ML Service: Lambda / Cloud Functions / Container Instances

## 🔒 Security Checklist

- [ ] Change default JWT_SECRET to a strong random value
- [ ] Use HTTPS in production (SSL/TLS certificates)
- [ ] Restrict CORS origins to your domain
- [ ] Use MongoDB Atlas with authentication enabled
- [ ] Set NODE_ENV=production
- [ ] Implement rate limiting (optional)
- [ ] Enable MongoDB authentication
- [ ] Use environment variables for all secrets (never commit .env files)
- [ ] Implement proper logging and monitoring

## 🧪 Health Checks

After deployment, verify all services:

```bash
# Backend
curl http://localhost:5001/api/health

# ML Service
curl http://localhost:8000/health
```

## 📊 Monitoring

Consider setting up:
- **Application Monitoring**: PM2, New Relic, DataDog
- **Error Tracking**: Sentry
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Log Management**: Logtail, Papertrail

## 🔧 Troubleshooting

### Backend won't start
- Check MongoDB connection string
- Verify PORT is not in use
- Check logs: `pm2 logs glucomind-backend`

### ML Service errors
- Ensure model files exist in `ml-service/models/`
- Run training scripts if needed
- Check Python dependencies

### Frontend API calls fail
- Verify VITE_API_BASE_URL is correct
- Check CORS settings in backend
- Inspect browser console for errors

## 📝 Maintenance

### Update Application
```bash
git pull origin main
cd backend && npm install
cd ../frontend && npm install && npm run build
cd ../ml-service && pip install -r requirements.txt
pm2 restart all
```

### Retrain ML Model
```bash
cd ml-service
python generate_dataset.py
python train_model.py
pm2 restart glucomind-ml
```

## 🎯 Next Steps

1. Set up continuous deployment (CI/CD)
2. Implement automated backups
3. Configure monitoring and alerts
4. Set up staging environment
5. Document API endpoints
6. Implement feature flags

---

**Questions?** Check the README or create an issue on GitHub.
