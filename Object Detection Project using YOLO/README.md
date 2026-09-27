# 📹 Dahua Home CCTV Object Detection using YOLO11

End-to-End Computer Vision Project for Residential Perimeter Security and Delivery Monitoring.

---

## 📌 Project Overview
This project addresses real-world smart surveillance by training a state-of-the-art **Ultralytics YOLO11** model on real footage captured from an outdoor **Dahua IP CCTV Camera**. Over 100+ frames were extracted and annotated using **Roboflow** for:
- 🚶 **`person`**: Intruder / visitor alert at entrance or gate.
- 🚗 **`vehicle`**: Cars, motorcycles, and rickshaws moving or parked along the perimeter.
- 📦 **`package`**: Delivery boxes left unattended on the doorstep or porch.

---

## 📁 Repository & Submission Files

| File | Description |
| :--- | :--- |
| **`CCTV_Security_YOLO11_Detection.ipynb`** | Complete, self-contained Google Colab & Jupyter Notebook with pipeline steps 1 to 9. |
| **`PROJECT_REPORT.md`** | Comprehensive academic/technical report ready for submission (can be exported to PDF). |
| **`dahua_rtsp_inference.py`** | Standalone Python script for live Dahua RTSP video stream monitoring with visual security alerts. |
| **`README.md`** | Quickstart and submission checklist. |

---

## 🚀 How to Run the Notebook on Google Colab

1. **Upload Notebook:**
   - Open [Google Colab](https://colab.research.google.com/).
   - Click **Upload** and select [`CCTV_Security_YOLO11_Detection.ipynb`](./CCTV_Security_YOLO11_Detection.ipynb).

2. **Enable GPU Acceleration:**
   - Go to **Runtime** > **Change runtime type** > Select **T4 GPU** > Click **Save**.

3. **Insert Your Roboflow API Key & Project Details:**
   - In **Step 2**, replace the placeholders with your Roboflow credentials:
     ```python
     ROBOFLOW_API_KEY = "your_actual_key"
     WORKSPACE_NAME = "your_workspace"
     PROJECT_NAME = "your_project"
     ```
   - *Alternatively:* If your dataset is in Google Drive, mount your drive and point `data_yaml_path` to your extracted folder.

4. **Run All Cells:**
   - Go to **Runtime** > **Run all** (`Ctrl + F9`).
   - The notebook will train YOLO11, output evaluation graphs (mAP, Precision, Recall, Confusion Matrix), and display detection predictions on CCTV test images.

---

## 🎥 Running Live Dahua RTSP Stream Locally

To run detection on your live Dahua camera stream from your PC:
```bash
# 1. Install requirements
pip install ultralytics opencv-python

# 2. Run with your Dahua RTSP URL
python dahua_rtsp_inference.py --source "rtsp://admin:password@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0"

# Or test with your webcam:
python dahua_rtsp_inference.py --source 0

# Or test on a recorded video clip:
python dahua_rtsp_inference.py --source sample_video.mp4
```

---

## 📋 Assignment Submission Checklist (Deadline: 28th September)

- [ ] **1. Colab / Jupyter Notebook:** Upload `CCTV_Security_YOLO11_Detection.ipynb` to Google Drive or GitHub.
- [ ] **2. Dataset Link:** Copy your public or shared Roboflow dataset URL and paste it into `PROJECT_REPORT.md` and your submission portal.
- [ ] **3. Project Report:** Open `PROJECT_REPORT.md`, fill in your name and student ID at the top, and export to PDF (or submit markdown).
- [ ] **4. Output Images / Graphs:** Save `confusion_matrix.png`, `results.png`, and a sample test prediction image from `runs/detect/` to attach to your submission.
