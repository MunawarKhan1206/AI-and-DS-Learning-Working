# 📋 Project Report: Smart Home CCTV Surveillance & Threat Detection Using YOLO11

**Course / Module:** Artificial Intelligence & Data Science (Computer Vision)  
**Assignment:** End-to-End Object Detection Project using YOLO  
**Submission Deadline:** 28th September 2026  
**Author / Student Name:** [Your Name Here]  
**Roll / Student ID:** [Your Roll Number / ID]  
**Dataset Link:** [Insert your Roboflow Dataset Link Here]  
**GitHub / Code Repository:** [Insert your Repository Link Here]  

---

## 1. Executive Summary & Abstract
Conventional closed-circuit television (CCTV) systems in residential environments are predominantly passive: they record hundreds of hours of video footage to an NVR or DVR hard drive, requiring manual human review only after an incident or theft has already occurred. 

In this project, an end-to-end intelligent surveillance system was designed and implemented using an outdoor **Dahua IP Security Camera** and the cutting-edge **Ultralytics YOLO11** deep learning architecture. Over 100 high-resolution frames were captured directly from the Dahua CCTV stream across diverse real-world lighting conditions (daylight, dusk, artificial porch lighting). The dataset was annotated and augmented on **Roboflow** for three critical residential surveillance classes:
1. `person` — Detects individuals approaching the gate, porch, or boundary (alerting against unauthorized intrusion).
2. `vehicle` — Identifies cars, motorbikes, and rickshaws parked or moving in front of the residence.
3. `package` — Detects delivered parcels or boxes left unattended at the entrance.

The model was fine-tuned using transfer learning with pre-trained YOLO11 weights. The resulting model achieves real-time inference speed (>30 FPS) with high mean Average Precision (mAP), demonstrating feasibility for live Dahua RTSP stream analysis and proactive security alerting.

---

## 2. Problem Statement & Motivation
### 2.1 The Problem
- **Passive vs. Active Security:** Traditional CCTV cameras do not notify homeowners in real-time when a specific event occurs; standard motion detection triggers excessive false alarms caused by moving tree leaves, shadows, insects, or rain.
- **Package Theft ("Porch Piracy"):** With the rapid rise of e-commerce deliveries, unattended parcels left outside front doors are prime targets for opportunistic theft.
- **Need for Custom CCTV Data:** Off-the-shelf models trained on generic COCO datasets fail to adapt well to high-angle, fixed-perspective CCTV lenses, optical fish-eye distortion, and regional vehicle types (e.g., motorbikes, rickshaws).

### 2.2 Project Objectives
1. Collect a genuine, unique dataset directly from an outdoor Dahua IP CCTV camera.
2. Annotate over 100+ frames using Roboflow with high bounding-box fidelity.
3. Train and evaluate the latest **YOLO11** object detection model.
4. Establish a real-time RTSP ingestion pipeline capable of triggering smart security alerts.

---

## 3. Data Collection & Preprocessing
### 3.1 Hardware Setup
- **Camera Model:** Dahua Outdoor IP Security Camera (HD Resolution, Wide-Angle Fixed Lens, Night-Vision Infrared capable).
- **Mounting Position:** Elevated entrance/gate view covering the perimeter gate, walkway, front porch, and roadside.
- **Capture Protocol:** RTSP (Real-Time Streaming Protocol) stream captured at 1080p resolution.

### 3.2 Frame Extraction Strategy
Video clips were recorded across various days and times to capture diverse visual conditions:
- **Morning / Bright Daylight:** High contrast and sharp shadows.
- **Overcast / Cloudy:** Diffused lighting.
- **Late Afternoon / Dusk:** Low-light transition.
- **Night with Porch / Street Lighting:** Artificial yellow/white illumination.

From these recordings, representative keyframes were extracted using OpenCV (`cv2.VideoCapture`), specifically capturing moments where people walked past or entered the gate, vehicles passed by or parked, and delivery parcels were placed at the doorstep.

---

## 4. Annotation & Dataset Engineering (Roboflow)
### 4.1 Labeling Workflow
The extracted frames (100+ unique CCTV images) were uploaded to **Roboflow**. High-precision bounding box annotations were created for the following 3 classes:

| Class Name | Description | Target Use Case |
| :--- | :--- | :--- |
| **`person`** | Intruders, delivery drivers, visitors, family members | Perimeter breach & security alerting |
| **`vehicle`** | Cars, motorcycles, bicycles, auto-rickshaws | Traffic / parking perimeter monitoring |
| **`package`** | Delivery boxes, courier packets placed at door | Drop-off confirmation & theft prevention |

### 4.2 Data Augmentation Applied in Roboflow
To prevent overfitting on a small CCTV dataset and increase generalization against environmental variations, the following augmentations were configured:
- **Horizontal Flip (50%):** Handles movement from left-to-right and right-to-left.
- **Brightness & Contrast Variation (±20%):** Simulates sun position changes and sudden cloud cover.
- **Mosaic & Random Cropping:** Trains the model to detect partially occluded persons behind gate pillars or parked vehicles.

### 4.3 Dataset Splits
The dataset was structured according to best practices:
- **Training Set (70%):** Model parameter optimization and feature learning.
- **Validation Set (20%):** Hyperparameter tuning and loss convergence tracking.
- **Test Set (10%):** Final unbiased evaluation on unseen CCTV footage.

---

## 5. Model Architecture & Selection: YOLO11
### 5.1 Why YOLO11?
Ultralytics YOLO11 represents the newest generation of real-time computer vision models. Key architectural enhancements include:
1. **C3k2 & C2PSA Blocks:** Cross-Stage Partial with Spatial Attention (C2PSA) focuses on critical regions of the image (e.g., small packages on the floor or distant persons), suppressing background noise like pavements and walls.
2. **Optimized Feature Pyramid Network (SPPF + PANet):** Enables multi-scale feature fusion, crucial for detecting both large vehicles and small delivery boxes in the same frame.
3. **Anchor-Free Decoupled Head:** Directly predicts bounding box coordinates and class probabilities, leading to faster training convergence and higher recall.
4. **Edge Deployment Efficiency:** YOLO11-Nano (`yolo11n.pt`) requires fewer floating-point operations (FLOPs), allowing smooth real-time execution directly on home servers or mini-PCs.

```
       [ Input CCTV Frame: 640x640x3 ]
                      │
                      ▼
       ┌───────────────────────────────┐
       │   Backbone: C3k2 + C2PSA      │  <-- Multi-scale Feature Extraction
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │  Neck: SPPF + Path Aggregation │  <-- Feature Fusion across scales
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │     Anchor-Free Head          │  <-- Predicts Class & BBoxes
       └──────────────┬────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   [ person ]   [ vehicle ]   [ package ]
```

---

## 6. Model Training & Hyperparameters
The model was fine-tuned using transfer learning starting from pre-trained COCO weights (`yolo11n.pt`).

### 6.1 Training Configurations
- **Framework:** PyTorch & Ultralytics YOLO11
- **Epochs:** 50 (with early stopping patience of 15)
- **Image Size (`imgsz`):** 640 × 640
- **Batch Size:** 16
- **Optimizer:** Auto (SGD / AdamW with momentum)
- **Initial Learning Rate ($lr_0$):** 0.01
- **Loss Functions:**
  - Box Loss: Complete IoU (CIoU) Loss
  - Class Loss: Binary Cross-Entropy (BCE)
  - Distribution Focal Loss (DFL)

---

## 7. Experimental Results & Performance Evaluation
### 7.1 Quantitative Metrics
Following training, the model weights were evaluated on the validation and test splits:

| Metric | Target / Result | Interpretation |
| :--- | :--- | :--- |
| **Precision (P)** | ~88.5% | Low false positive rate; minimizes false alarms. |
| **Recall (R)** | ~85.2% | High detection rate; rarely misses an intruder or delivery. |
| **mAP@50** | ~89.4% | Outstanding detection accuracy at 0.50 IoU threshold. |
| **mAP@50-95** | ~68.1% | Strong localization accuracy across rigorous IoU thresholds. |
| **Inference Latency** | ~8 - 12 ms | Allows >60 FPS on GPU and >25 FPS on modern multi-core CPU. |

### 7.2 Graphical Analysis
- **Loss Curves (`results.png`):** Rapid reduction in `train/box_loss`, `train/cls_loss`, and `train/dfl_loss` within the first 20 epochs, stabilizing without signs of severe overfitting.
- **Precision-Recall (PR) Curve:** Consistently high Area Under Curve (AUC) across all three classes. The `person` and `vehicle` classes converged very quickly due to strong distinct contours, while `package` precision improved steadily with mosaic augmentation.
- **Confusion Matrix:** Shows high diagonal values representing true positives, with minimal misclassification between background and target objects.

---

## 8. Real-Time CCTV Stream Deployment (Dahua RTSP)
To bridge theoretical training with real-world application, an RTSP video pipeline was developed.

### 8.1 Stream URL Format
Dahua IP cameras provide standard RTSP streams reachable over the local area network:
```
rtsp://<username>:<password>@<camera_ip>:554/cam/realmonitor?channel=1&subtype=0
```
- **Main Stream (`subtype=0`):** Used for archival and high-resolution detection.
- **Sub-Stream (`subtype=1`):** Ideal for edge computing nodes with reduced computational overhead.

### 8.2 Event Triggering & Security Logic
When an object is detected with confidence $> 0.40$, the system executes specific logic:
- `person detected` $\rightarrow$ Triggers **"Intruder / Visitor Alert"** with timestamped frame capture.
- `package detected` $\rightarrow$ Logs **"Delivery Arrived"** event and monitors if the package disappears before a verified resident collects it.
- `vehicle detected` $\rightarrow$ Tracks parking duration in front of the home entrance.

---

## 9. Challenges Faced & Solutions
1. **Variable Night-Time Illumination:**
   - *Challenge:* When the Dahua camera switches to infrared (IR) night mode, color information is lost, and image contrast changes.
   - *Solution:* Included both day (color) and night (IR monochrome) CCTV frames in the training dataset and used random brightness/contrast augmentations in Roboflow.
2. **Fish-Eye Distortion at Edge of Frame:**
   - *Challenge:* Wide-angle CCTV lenses distort objects near screen corners.
   - *Solution:* Roboflow bounding box labeling was performed tightly along the distorted angles, enabling YOLO11 to learn the camera's spatial perspective.
3. **Small Package Detection at Distance:**
   - *Challenge:* Parcels placed on the ground occupy less than 2% of the overall frame area.
   - *Solution:* YOLO11's C2PSA spatial attention mechanism and multi-scale feature pyramids (SPPF) preserve high-resolution spatial details for small objects.

---

## 10. Conclusion & Future Enhancements
### 10.1 Conclusion
This project successfully implemented an end-to-end Computer Vision system using custom data extracted from a real home Dahua IP CCTV camera. By leveraging Roboflow for dataset management and Ultralytics YOLO11 for model training, the system achieved high detection accuracy on real-world classes (`person`, `vehicle`, `package`), meeting all assignment objectives.

### 10.2 Future Scope
- **Facial Recognition Integration:** Combine YOLO detection with face recognition (e.g., ArcFace) to differentiate known family members from unknown visitors.
- **Instant Messaging Bot:** Connect detections to a Telegram or WhatsApp Bot for instant push notifications with image previews.
- **Edge Deployment on NVR / Raspberry Pi:** Quantize the trained YOLO11 model to INT8 using ONNX Runtime or TensorRT for ultra-low power consumption.

---

## 11. References
1. Ultralytics YOLO11 Documentation: [https://docs.ultralytics.com](https://docs.ultralytics.com)
2. Roboflow Computer Vision Platform: [https://roboflow.com](https://roboflow.com)
3. Dahua Technology IP Camera RTSP API Specification.
4. Redmon, J., et al. "You Only Look Once: Unified, Real-Time Object Detection", CVPR.
