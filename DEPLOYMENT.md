# 🚀 StreamVault Deployment Guide

## Quick Start Commands

### Development Mode
```bash
# Terminal 1 - Backend
cd streamvault/streamvault-api/StreamVault.Api
dotnet run --urls="http://localhost:7166"

# Terminal 2 - Frontend  
cd streamvault-frontend
npm install
npm run dev
```

**Access**: Frontend at http://localhost:5175 | Backend at http://localhost:7166

---

## Production Deployment

### 🔧 **Prerequisites**
- **Node.js 18+** & **npm**
- **.NET 8.0 SDK** 
- **Web server** (IIS, Apache, Nginx)

### 🏗️ **Frontend Production Build**

1. **Build for Production:**
   ```bash
   cd streamvault-frontend
   npm run build
   ```

2. **Deploy dist/ folder** to your web server
3. **Configure environment variables** in production

### ⚙️ **Backend Production Build** 

1. **Publish Release Build:**
   ```bash
   cd streamvault/streamvault-api/StreamVault.Api
   dotnet publish -c Release -o ./publish
   ```

2. **Deploy publish/ folder** to your hosting provider
3. **Configure production appsettings.json**

---

## 🌐 **API Configuration**

### **Required for Live Data (Optional)**

#### **TMDB API Setup**
1. **Sign up**: https://www.themoviedb.org/settings/api
2. **Get API Key** from account settings  
3. **Add to appsettings.json:**
   ```json
   {
     "ExternalApis": {
       "TmdbApiKey": "your_tmdb_api_key_here"
     }
   }
   ```

#### **Jikan API (MyAnimeList)**
- ✅ **No API key needed** - Free to use
- ⚠️ **Rate limited** - 3 requests/second (handled automatically)

---

## 📊 **Database Configuration**

### **Development (Default)**
- **SQLite** - No setup needed
- **File**: `data/streamvault.db`

### **Production Options**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=your-server;Database=StreamVault;Trusted_Connection=true;"
  }
}
```

---

## 🔧 **Environment Configuration**

### **Frontend (.env)**
```bash
VITE_API_BASE=http://localhost:7166/api
# or production URL
VITE_API_BASE=https://api.yourdomain.com/api  
```

### **Backend (appsettings.json)**
```json
{
  "Jwt": {
    "Key": "your-super-secret-jwt-key-here",
    "Issuer": "StreamVault",
    "Audience": "StreamVaultUsers"
  },
  "ExternalApis": {
    "TmdbApiKey": "optional-tmdb-key",
    "JikanBaseUrl": "https://api.jikan.moe/v4"
  }
}
```

---

## 🌐 **Hosting Options**

### **Frontend Hosting**
- **Vercel** (Recommended) - Zero config deployment
- **Netlify** - Static site hosting
- **GitHub Pages** - Free static hosting
- **AWS S3 + CloudFront** - Enterprise solution

### **Backend Hosting**
- **Azure App Service** - ASP.NET Core native
- **Railway** - Simple container deployment
- **Digital Ocean App Platform** - Managed hosting
- **AWS EC2/ECS** - Full control hosting

---

## 🚀 **One-Click Deploy Examples**

### **Vercel (Frontend)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from streamvault-frontend directory
cd streamvault-frontend
vercel --prod
```

### **Railway (Backend)**
```bash
# Install Railway CLI  
npm install -g @railway/cli

# Deploy from StreamVault.Api directory
cd streamvault/streamvault-api/StreamVault.Api
railway login
railway up
```

---

## 🔐 **Security Checklist**

### **Production Security**
- [ ] **Generate strong JWT secret key**
- [ ] **Use HTTPS in production**
- [ ] **Configure CORS for your domain**
- [ ] **Set secure connection strings**
- [ ] **Enable request rate limiting**
- [ ] **Use environment variables for secrets**

### **CORS Configuration**
```csharp
// In Program.cs for production
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(builder =>
    {
        builder.WithOrigins("https://yourdomain.com")
               .AllowAnyMethod()
               .AllowAnyHeader()
               .AllowCredentials();
    });
});
```

---

## 📊 **Performance Optimization**

### **Frontend Optimizations**
- ✅ **Code splitting** enabled (Vite)
- ✅ **Lazy loading** for images
- ✅ **Tree shaking** for smaller bundles
- ✅ **Asset compression** in build

### **Backend Optimizations**  
- ✅ **Response caching** for static data
- ✅ **Database connection pooling**
- ✅ **API rate limiting**
- ✅ **Gzip compression** enabled

---

## 🐛 **Troubleshooting**

### **Common Issues**

**CORS Errors:**
- Update backend CORS policy for production domain
- Ensure frontend URL matches CORS configuration

**API Key Issues:**
- App works with mock data if APIs unavailable
- Check `/app/status` page for API health 

**Database Connection:**
- Verify connection string format
- Check database server accessibility
- Ensure migrations applied (`dotnet ef database update`)

**Build Failures:**
- Clear node_modules and reinstall
- Verify .NET SDK version (8.0+)
- Check for TypeScript errors

---

## 🎯 **Ready for Production!**

StreamVault is designed to work seamlessly in production with:
- **🔄 Auto-fallback** to mock data if APIs unavailable
- **📊 Health monitoring** via `/app/status` endpoint  
- **🛡️ Security-first** JWT authentication
- **⚡ High performance** with optimized builds
- **📱 Mobile responsive** design

**🚀 Deploy with confidence - StreamVault has you covered!**