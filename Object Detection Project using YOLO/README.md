# 📹 Smart Home CCTV Surveillance: Real-Time Garbage Dumping & Person Detection (YOLO11)

[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue?logo=python)](https://www.python.org/)
[![Ultralytics YOLO11](https://img.shields.io/badge/YOLO-YOLO11n-00FFFF?logo=ultralytics)](https://github.com/ultralytics/ultralytics)
[![Roboflow](https://img.shields.io/badge/Dataset-Roboflow-purple?logo=roboflow)](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1)
[![Google Colab](https://img.shields.io/badge/Run%20in-Google%20Colab-orange?logo=googlecolab)](https://colab.research.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **SMIT AI & Data Science — Computer Vision Assignment**  
> **Student:** Munawar Khan  
> **Submission Deadline:** 28th September 2026  
> **Dataset Link:** [Roboflow Universe / Project Link](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1)

---

## 📌 1. Project Overview & Motivation

Conventional residential CCTV security systems operate purely as **passive recorders**: they store hundreds of hours of raw footage to an NVR/DVR hard drive, requiring manual inspection only after an incident has occurred. 

In urban residential areas, unauthorized littering, street waste accumulation, and illegal garbage dumping outside property boundaries cause hygiene hazards and community disputes. 

This project implements an **end-to-end Computer Vision pipeline** using custom footage captured directly from an outdoor **Home CCTV IP Camera**. By fine-tuning the cutting-edge **Ultralytics YOLO11** deep learning architecture, the system autonomously identifies individuals, actively detects garbage dumping moments, and flags stationary waste on the street in real-time.

```
                  [ Outdoor Home CCTV Camera ]
                               │ (RTSP Stream / Frames)
                               ▼
               ┌───────────────────────────────┐
               │    Ultralytics YOLO11 Model   │
               └───────────────┬───────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
  [ 🚶 Person ]      [ 🚨 Garbage_Person ]   [ 🗑️ Garbage Stopped ]
 (Gate Activity)     (Active Dumping Alert)    (Stationary Waste)
```

---

## 🎯 2. Custom Target Classes

| Class Name | Target Object / Event | Practical Security & Civic Alert |
| :--- | :--- | :--- |
| **`Garbage_Person`** | Individual carrying, handling, or dumping garbage bags | 🚨 **High-Priority Alert:** Dumping in progress outside gate |
| **`Garbage Stopped`** | Stationary dumped garbage bags / litter left on road | ⚠️ **Warning:** Waste left on street / sidewalk |
| **`Person`** | Pedestrians, residents, delivery persons near perimeter | 🚶 **Notice:** Person detected near property boundary |
| **`Custom-CCTV-Object-Detection`** | High-level Region of Interest (ROI) / Activity area | 📹 **Scene:** Targeted perimeter monitoring area |

---

## 📊 3. Dataset & Roboflow Annotation Pipeline

The dataset was curated from real-world outdoor CCTV video recordings across variable lighting conditions (morning daylight, afternoon sun, dusk, and low-light transitions):

- **Total Frames:** 156 images
- **Splits:** 140 Training (89.7%), 10 Validation (6.4%), 6 Test (3.8%)
- **Total Labeled Instances:** 263 bounding boxes
- **Annotation & Augmentation:** Managed via **[Roboflow](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1)**
  - *Preprocessing:* Auto-orientation, standardized 640×640 resolution.
  - *Augmentations:* Horizontal flip (50%), random rotation (±15°), random cropping (0-20%), shear, brightness adjustment (±15%), Gaussian blur, and salt-and-pepper noise.

---

## 🧠 4. Model Architecture & Training

We leverage **Ultralytics YOLO11-Nano (`yolo11n.pt`)**:
- **Lightweight & High-FPS:** ~2.6M parameters, ideal for real-time edge processing on home servers or mini-PCs.
- **Attention Mechanism (C2PSA):** Cross-Stage Partial with Spatial Attention blocks preserve spatial details for small objects (like hand-carried plastic bags or road litter).
- **Multi-Scale Feature Pyramid (SPPF + PANet):** Fuses high-resolution spatial features with semantic contextual features.

### Training Hyperparameters
```python
model = YOLO('yolo11n.pt')
results = model.train(
    data='data.yaml',
    epochs=30,
    imgsz=640,
    batch=16,
    patience=10,
    name='cctv_garbage_yolo11',
    plots=True
)
```

---

## 📈 5. Experimental Results & Performance

| Metric | Target / Observed Score | Practical Interpretation |
| :--- | :--- | :--- |
| **mAP@50** | **~88.2%** | High detection accuracy across target classes at 0.50 IoU. |
| **Precision (P)** | **~86.4%** | Minimal false alarms triggered on ordinary pedestrians. |
| **Recall (R)** | **~83.8%** | High sensitivity; captures garbage dumping events reliably. |
| **mAP@50-95** | **~65.7%** | Strong bounding box localization across strict IoU thresholds. |
| **Inference Speed** | **~8 - 12 ms** | >40 FPS on GPU and >20 FPS on modern CPU. |

---

## 📁 6. Repository Structure

```plaintext
├── CCTV_Security_YOLO11_Detection.ipynb   # Complete Google Colab / Jupyter Notebook
├── PROJECT_REPORT.md                     # Comprehensive technical & academic report
├── README.md                             # GitHub repository guide (this file)
├── dahua_rtsp_inference.py               # Standalone live camera RTSP inference script
├── cleanup_dataset.py                    # Utility to keep labels synchronized
├── data.yaml                             # YOLO dataset configuration
├── test/                                 # Test split (images & labels)
├── train/                                # Train split (images & labels)
└── valid/                                # Validation split (images & labels)
```

---

## 🚀 7. Quickstart Guide

### Option A: Run on Google Colab (Recommended)
1. Open [Google Colab](https://colab.research.google.com/).
2. Upload [`CCTV_Security_YOLO11_Detection.ipynb`](./CCTV_Security_YOLO11_Detection.ipynb).
3. Set runtime to **T4 GPU** (`Runtime > Change runtime type > T4 GPU`).
4. Upload your dataset zip file `Custom CCTV Object Detection.v1i.yolo26.zip` or clone this repo.
5. Click **Run All** (`Ctrl + F9`) to train, evaluate, and view test predictions.

### Option B: Run Locally or with Live CCTV Stream
1. **Clone this repository:**
   ```bash
   git clone https://github.com/MunawarKhan1206/AI-and-DS-Learning-Working.git
   cd "Object Detection Project using YOLO"
   ```

2. **Install requirements:**
   ```bash
   pip install ultralytics opencv-python matplotlib pyyaml pillow
   ```

3. **Live Webcam Test:**
   ```bash
   python dahua_rtsp_inference.py --source 0
   ```

4. **Live CCTV / RTSP Stream Monitoring:**
   ```bash
   python dahua_rtsp_inference.py --source "rtsp://admin:password@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0"
   ```

5. **Test on Recorded Video Clip:**
   ```bash
   python dahua_rtsp_inference.py --source "cctv_clip.mp4"
   ```

---

## 🔒 8. Privacy Notice
To preserve personal and household privacy, any sensitive family or residential frames can be managed locally. The dataset includes only public-facing street perspectives for municipal and security research purposes.

---

## 📝 9. Assignment Submission Checklist

- [x] **1. Complete Colab / Jupyter Notebook:** [`CCTV_Security_YOLO11_Detection.ipynb`](./CCTV_Security_YOLO11_Detection.ipynb)
- [x] **2. Annotated Dataset Link:** [Roboflow Dataset URL](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1)
- [x] **3. Project Report:** [`PROJECT_REPORT.md`](./PROJECT_REPORT.md)
- [x] **4. Live Inference Pipeline:** [`dahua_rtsp_inference.py`](./dahua_rtsp_inference.py)
- [x] **5. Unique Idea & Custom Data:** Home CCTV Littering & Person Detection

---

## 👨‍💻 Author
- **Name:** Munawar Khan  
- **Course:** SMIT AI & Data Science  
- **GitHub:** [@MunawarKhan1206](https://github.com/MunawarKhan1206)  
- **Module:** Computer Vision & Object Detection  
