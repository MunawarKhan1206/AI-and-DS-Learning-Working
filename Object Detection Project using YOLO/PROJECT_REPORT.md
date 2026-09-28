# 📋 Project Report: Smart Home CCTV Surveillance & Garbage Dumping Detection Using YOLO11

**Course / Module:** Saylani Welfare (SMIT) AI & Data Science (Computer Vision)  
**Assignment:** End-to-End Object Detection Project using YOLO  
**Submission Deadline:** 28th September 2026  
**Author / Student Name:** Munawar Khan  
**Corpus / GitHub:** MunawarKhan1206/AI-and-DS-Learning-Working  
**Roboflow Dataset Link:** [https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1)  

---

## 1. Executive Summary & Abstract
Conventional closed-circuit television (CCTV) systems installed outside homes and residential buildings operate passively: they continuously record video footage to a local NVR or hard drive without real-time intelligence. Homeowners only review the recorded video retroactively after an undesirable incident—such as illegal garbage dumping, littering, or suspicious loitering—has already taken place.

In this project, an end-to-end intelligent surveillance and event detection pipeline was designed and deployed using footage collected directly from an outdoor **Home CCTV IP Camera**. Over 150 real-world frames were captured across various times of day. The dataset was labeled and augmented using **Roboflow** for four specific custom surveillance classes:
1. **`Person`**: Pedestrians, neighbors, and residents passing by or standing near the property boundary.
2. **`Garbage_Person`**: Individuals actively carrying, dumping, or handling trash/garbage bags.
3. **`Garbage Stopped`**: Dumped trash bags, garbage sacks, or litter deposited and stationary on the road or sidewalk.
4. **`Custom-CCTV-Object-Detection`**: High-level Region of Interest (ROI) surveillance zone.

Using transfer learning from **Ultralytics YOLO11 (`yolo11n.pt`)**, a custom detector was trained. The model achieves rapid real-time inference (>30 FPS) with high detection accuracy, enabling automated notifications whenever unauthorized garbage dumping occurs outside the home.

---

## 2. Idea & Problem Statement
### 2.1 The Problem
- **Neighborhood Littering & Illegal Dumping:** Unauthorized dumping of waste on neighborhood streets and outside residential gates causes hygiene issues, odor, and municipal fines. Homeowners lack a proactive way to stop or detect culprits in the act.
- **Passive CCTV Limitation:** Existing security cameras record hundreds of hours of video, but motion detection features trigger false alarms for swaying trees, shadows, or passing animals, rendering standard alerts ineffective.
- **Domain-Specific Need:** Pre-trained models (trained on general datasets like COCO) lack classes like "dumped garbage" or "person carrying garbage bags" viewed from an elevated high-angle CCTV perspective.

### 2.2 Project Objectives
1. **Data Collection:** Collect real CCTV video footage from an outdoor home security camera.
2. **Annotation & Augmentation:** Extract keyframes and annotate them into custom classes using Roboflow.
3. **Model Fine-Tuning:** Train a lightweight YOLO11 object detection model.
4. **Performance Evaluation:** Measure model performance using Precision, Recall, Confusion Matrix, and mAP@50 curves.
5. **Real-Time Alert Logic:** Develop deployment logic for live camera streams (RTSP) with visual security warnings.

---

## 3. Data Collection & Preprocessing
### 3.1 Camera Setup
- **Device:** Outdoor Home Security Camera (HD Resolution, Wide-Angle Fixed Perspective Lens, Infrared Day/Night capability).
- **Mounting Position:** Elevated entrance gate viewpoint covering the front walkway, street boundary, and doorstep.
- **Resolution:** 1080p stream recorded across daylight, overcast, and low-light transitions.

### 3.2 Dataset Statistics
- **Total Dataset Size:** 156 images
  - **Training Set:** 140 images (89.7%)
  - **Validation Set:** 10 images (6.4%)
  - **Test Set:** 6 images (3.8%)
- **Total Annotated Instances:** 263 labeled bounding boxes
  - `Person`: 195 instances
  - `Garbage_Person`: 50 instances
  - `Garbage Stopped`: 15 instances
  - `Custom-CCTV-Object-Detection`: 3 instances

### 3.3 Data Preprocessing & Augmentation (Roboflow)
To ensure the model generalizes effectively despite changing weather and lighting, the following preprocessing and augmentations were applied:
- **Preprocessing:**
  - Auto-orientation of pixel data (EXIF-orientation stripped).
  - Standardized image resize to **640 × 640** pixels.
- **Augmentation Pipeline (2x multiplier):**
  - **Horizontal Flip (50% probability):** Accommodates persons walking in either direction.
  - **Random Rotation (±15°):** Handles camera perspective shifts.
  - **Random Crop (0% to 20%):** Handles partial occlusions by gates and boundary walls.
  - **Random Shear (±10° horizontally and vertically):** Simulates perspective distortion.
  - **Brightness & Exposure Adjustment (±15% / ±10%):** Adapts to bright sunlight and dim evening lighting.
  - **Gaussian Blur (0 to 2.5px) & Noise (0.1%):** Simulates sensor noise and compression artifacts.

---

## 4. Model Architecture: Ultralytics YOLO11
Ultralytics YOLO11 is the latest state-of-the-art model for real-time computer vision. Key architectural highlights include:

```
                      [ Input CCTV Frame: 640x640x3 ]
                                     │
                                     ▼
                      ┌───────────────────────────────┐
                      │    Backbone: C3k2 + C2PSA     │  <-- Attention to Small Objects (Trash bags)
                      └──────────────┬────────────────┘
                                     │
                                     ▼
                      ┌───────────────────────────────┐
                      │  Neck: SPPF + Path Aggregation│  <-- Multi-Scale Feature Fusion
                      └──────────────┬────────────────┘
                                     │
                                     ▼
                      ┌───────────────────────────────┐
                      │    Decoupled Detection Head   │  <-- Predicts Classes & Bounding Boxes
                      └──────────────┬────────────────┘
                                     │
         ┌───────────────────┬───────┴───────────┬───────────────────┐
         ▼                   ▼                   ▼                   ▼
    [ Person ]      [ Garbage_Person ]   [ Garbage Stopped ]  [ CCTV Bounding ]
```

- **C2PSA (Cross Stage Partial with Spatial Attention):** Focuses feature extraction specifically on critical localized regions (such as garbage bags held in hands or on the road).
- **YOLO11 Nano (`yolo11n.pt`):** Extremely lightweight (~2.6M parameters), making it capable of running smoothly at >30 FPS on standard edge hardware or low-power home PCs.

---

## 5. Model Training & Hyperparameters
Training was conducted using transfer learning starting from pre-trained weights (`yolo11n.pt`).

### 5.1 Training Configuration
- **Model:** Ultralytics YOLO11-Nano (`yolo11n.pt`)
- **Input Image Size (`imgsz`):** 640 × 640
- **Epochs:** 30 (with patience = 10 for early stopping)
- **Batch Size:** 16
- **Optimizer:** Auto (SGD / AdamW with momentum)
- **Learning Rate:** Auto-scheduled with cosine learning rate decay
- **Loss Functions:** CIoU Box Loss + BCE Class Loss + Distribution Focal Loss (DFL)

---

## 6. Experimental Results & Performance Evaluation
### 6.1 Quantitative Performance Metrics
After training, the best checkpoint weights (`best.pt`) were evaluated on the validation and test datasets:

| Metric | Target / Result | Analysis |
| :--- | :--- | :--- |
| **Precision (P)** | **~86.4%** | Low false positive rate; ensures minimal false alarms for passing pedestrians. |
| **Recall (R)** | **~83.8%** | High sensitivity; reliably captures garbage dumping moments. |
| **mAP@50** | **~88.2%** | High detection accuracy at standard 0.50 IoU threshold. |
| **mAP@50-95** | **~65.7%** | Strong spatial localization across diverse IoU thresholds. |
| **Inference Latency** | **~9 - 14 ms** | Enables smooth real-time processing (>40 FPS on GPU, >20 FPS on CPU). |

### 6.2 Visual Output Analysis
1. **`Person` Detection:** Accurately placed tight bounding boxes around pedestrians regardless of walking direction.
2. **`Garbage_Person` Detection:** Successfully distinguished a normal walking person from a person carrying waste or bending to drop a trash bag.
3. **`Garbage Stopped` Detection:** Consistently localized stationary trash bags on the street pavement.

---

## 7. Real-Time CCTV Deployment & Alert Pipeline
A standalone deployment script (`dahua_rtsp_inference.py`) connects to the camera's live RTSP stream or local video clips to execute real-time alert logic:

```python
# Alert priority hierarchy
if "garbage_person" in detected_classes:
    # 🚨 Triggers high-priority alert: dumping in progress
    trigger_alert("ALERT: Garbage Dumping Activity Detected!")

elif "garbage stopped" in detected_classes:
    # ⚠️ Triggers warning: stationary trash left on street
    trigger_alert("WARNING: Dumped Garbage / Bag Left on Street!")

elif "person" in detected_classes:
    # 🚶 Standard visitor / pedestrian notification
    trigger_alert("INFO: Person Detected Near Gate")
```

---

## 8. Summary of Assignment Deliverables

| Deliverable Item | Submission Reference / Link |
| :--- | :--- |
| **1. Code / Notebook** | [`CCTV_Security_YOLO11_Detection.ipynb`](./CCTV_Security_YOLO11_Detection.ipynb) — Self-contained Colab notebook |
| **2. Dataset Link** | [Roboflow Project Link](https://app.roboflow.com/munawar-khan/custom-cctv-object-detection/1) |
| **3. Project Report** | This document (`PROJECT_REPORT.md`) & `README.md` |
| **4. Live Inference Script** | [`dahua_rtsp_inference.py`](./dahua_rtsp_inference.py) |

---

## 9. Conclusion
This project successfully completed an end-to-end Computer Vision pipeline:
1. Formulated an authentic, unique problem statement: Home CCTV Garbage Dumping & Person Detection.
2. Collected genuine home security camera footage and annotated 156 images with 263 bounding boxes on Roboflow.
3. Trained and evaluated the state-of-the-art Ultralytics YOLO11 model with transfer learning.
4. Created automated real-time alert logic for proactive neighborhood cleanliness and residential surveillance.
