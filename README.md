# 📦 Secure File Sharing Platform (Serverless)

A scalable, secure, and serverless file-sharing platform built on AWS that enables authenticated users to upload files/folders, generate shareable links, and control access with expiration.

---

## 🚀 Overview

This project replicates core functionality of platforms like Google Drive / Dropbox with a focus on:

- Secure file uploads  
- Shareable short links  
- Folder-level sharing  
- Expiry-based access control  
- Global content delivery via CDN  

Built using AWS-native services with an emphasis on **scalability, security, performance, and cost optimization**.

---

## 🏗️ Architecture

**Frontend**
- HTML, CSS, JavaScript (served locally or via S3/CloudFront)

**Backend (Serverless)**
- Amazon API Gateway  
- AWS Lambda  

**Storage & Delivery**
- Amazon S3 (file storage)  
- Amazon CloudFront (global CDN for fast downloads)  

**Database**
- Amazon DynamoDB (file metadata & sharing info)

**Authentication**
- Amazon Cognito  

---

## 🔁 System Flow

1. User logs in via Cognito  
2. Requests upload URL via API Gateway → Lambda  
3. Lambda generates **pre-signed S3 upload URL**  
4. File uploads directly to S3 (bypasses backend)  
5. Metadata stored in DynamoDB  
6. Short share link is generated  
7. On access:  
   - Lambda validates request  
   - Generates **pre-signed download URL**  
   - Redirects user via **CloudFront → S3**  

---

## ✨ Features

### 🔐 Authentication & Security
- Cognito-based authentication  
- IAM-secured backend  
- Pre-signed URLs (upload/download)  
- Expiry-based access control  

### 📤 Upload Capabilities
- Multi-file upload  
- Folder upload (preserves structure)  
- File preview before upload  
- Custom expiry (days / hours / minutes)  

### 🔗 Sharing
- Short links for files  
  `/share/{shortCode}`  
- Folder-level sharing  
  `/share/folder/{folderShareCode}`  
- One-click copy link  

### 📁 File Management
- View uploaded files  
- Folder grouping  
- Delete files  
- Expiry enforcement  

### ⚡ Performance (CloudFront CDN)
- Low-latency global downloads  
- Cached file delivery  
- Reduced direct S3 load  

---

## 🧠 Key Design Decisions

### 1. Pre-Signed URLs (Direct S3 Access)
- Eliminates backend bottlenecks  
- Scales to large file uploads  
- Reduces Lambda execution cost  

### 2. CloudFront for Content Delivery
- Improves global performance  
- Reduces latency for downloads  
- Enables caching for frequently accessed files  

### 3. DynamoDB for Metadata
- Fast lookups  
- Scalable storage for file/folder mapping  
- Flexible schema for sharing logic  

### 4. Serverless Architecture
- Fully managed services  
- Auto-scaling  
- Pay-per-use model  

---

## 📊 AWS Well-Architected Alignment

### 🔐 Security
- Cognito authentication  
- IAM role-based access  
- Time-bound pre-signed URLs  
- No public S3 exposure (via CloudFront)  

### ⚡ Performance Efficiency
- Direct S3 upload (no compute bottleneck)  
- CloudFront CDN for faster delivery  
- Stateless Lambda design  

### 💰 Cost Optimization
- Serverless (Lambda + API Gateway)  
- CloudFront caching reduces S3 requests  
- No idle infrastructure cost  

### 🛠 Reliability
- Highly available AWS services  
- Durable S3 storage  
- Decoupled architecture  

---

## 🧪 API Endpoints

```
POST   /upload_url
GET    /files
DELETE /file
GET    /share/{shortCode}
GET    /share/folder/{folderShareCode}
```

---

## 🛠️ Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/your-username/secure-file-sharing-platform.git
cd secure-file-sharing-platform
```

---

### 2. Run Frontend
```bash
cd frontend
python3 -m http.server 8000
```

Open:
```
http://localhost:8000
```

---

### 3. Configure Frontend

Update config:

```javascript
window.__APP_API_BASE_URL__ = "YOUR_API_GATEWAY_URL";
window.__APP_COGNITO_DOMAIN__ = "YOUR_COGNITO_DOMAIN";
window.__APP_CLIENT_ID__ = "YOUR_CLIENT_ID";
```

---

### 4. AWS Setup (High Level)

- Create S3 bucket  
- Create CloudFront distribution (origin: S3)  
- Create DynamoDB table  
- Create Lambda functions:
  - upload_url  
  - download_url  
  - get_files  
  - delete_file  
  - resolveShortLink  
- Configure API Gateway routes  
- Setup Cognito User Pool  

---

## 🔮 Future Enhancements

- 📦 ZIP download for folders  
- 📊 Upload progress bar  
- 🔍 Search & filters  
- 📁 Nested folder support  
- 🔐 Signed CloudFront URLs  
- 📊 Analytics (download tracking)  

---

## 💡 Learnings

- Designing scalable file-sharing systems  
- Using pre-signed URLs for secure access  
- Leveraging CloudFront for performance optimization  
- Implementing serverless architectures on AWS  
- Managing metadata with DynamoDB  

---

## 📌 Author

Mahesh Gorle  
MS ITM – University of Texas at Dallas  
Aspiring Solutions Architect / Technical Program Manager
