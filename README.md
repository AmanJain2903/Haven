# Haven
The goal is to solve the "Storage Full" crisis by reclaiming data sovereignty. Haven moves your digital life to local hardware (SSD/HDD/NAS) without sacrificing the intelligence of the cloud. By running SOTA AI models locally, Haven provides semantic search, facial recognition, and geospatial grouping, ensuring your memories remain safe &amp; private.

![Status](https://img.shields.io/badge/Status-In_Development-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Python](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React-61DAFB)

**Haven** is a self-hosted, intelligent Digital Asset Management (DAM) system designed to replace iCloud and Google Photos. It restores ownership of your memories by running state-of-the-art AI models locally on your own hardware.

> **"Your private sanctuary for digital memories."**

---

## 🧐 The Problem

We are facing a "Digital Storage Crisis":
1.  **Subscription Fatigue:** Cloud providers charge indefinite monthly fees for storage (2TB+), effectively holding memories ransom.
2.  **Privacy Trade-offs:** To get "smart features" like face grouping or search, users must upload personal data to public cloud servers.
3.  **The "Dumb Drive" Dilemma:** Moving photos to a local hard drive solves the cost/privacy issue but results in a loss of utility—no easy browsing, no search, and no automatic organization.

## 💡 The Solution: Haven

Haven bridges the gap between raw local storage and intelligent cloud services. It runs as a web application on your local machine (or home server), indexing your photos and videos to provide a premium "Big Tech" experience without the data leaving your home.

### Key Features (Planned)
* **Zero Recurring Costs:** Utilizing standard local storage (SSD/HDD/NAS).
* **AI-Powered Semantic Search:** Search for "birthday cake" or "dog running in grass" using CLIP embeddings—no manual tagging required.
* **Facial Recognition:** Automatic face detection and clustering to organize photos by people.
* **Geospatial Indexing:** Interactive map view to browse memories by location.
* **Blazing Fast UI:** A responsive React-based frontend optimized for large libraries.

---

## 🏗️ Architecture

Haven is built on a "Local-First" architecture. It leverages Docker to orchestrate a high-performance Python backend with a robust vector database.

```mermaid
graph TD
    User[User / Web Interface] -->|Browses| Frontend[React PWA]
    Frontend -->|API Requests| Backend[FastAPI Backend]
    
    subgraph "The Local Cloud"
        Backend -->|Query Metadata| DB[(PostgreSQL)]
        Backend -->|Vector Search| VectorDB[(pgvector)]
        Backend -->|Store Tasks| Redis[Redis Queue]
        
        Redis -->|Process| Worker[AI Workers]
        Worker -->|Run Models| AI[CLIP / DeepFace]
        
        AI -->|Save Embeddings| VectorDB
        Worker -->|Read/Write| Storage[Local SSD/HDD]
    end
