"""
Dahua CCTV Real-Time Object Detection & Security Alert System
Powered by Ultralytics YOLO11
"""

import cv2
import argparse
import time
from ultralytics import YOLO

def parse_args():
    parser = argparse.ArgumentParser(description="Real-time CCTV Detection with YOLO11")
    parser.add_argument(
        "--source", 
        type=str, 
        default="0", 
        help="Video source: RTSP URL (e.g. rtsp://user:pass@ip:554/cam/realmonitor?channel=1&subtype=0), video file path, or webcam index (0)"
    )
    parser.add_argument(
        "--weights", 
        type=str, 
        default="runs/detect/dahua_cctv_yolo11/weights/best.pt", 
        help="Path to trained YOLO11 weights (best.pt) or pre-trained yolo11n.pt"
    )
    parser.add_argument("--conf", type=float, default=0.40, help="Confidence threshold")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image resolution")
    return parser.parse_args()

def main():
    args = parse_args()

    # Load YOLO11 Model
    print(f"🔄 Loading YOLO11 model weights from: {args.weights}")
    try:
        model = YOLO(args.weights)
    except Exception as e:
        print(f"⚠️ Could not load custom weights ({e}). Falling back to 'yolo11n.pt'...")
        model = YOLO("yolo11n.pt")

    # Connect to video source (RTSP stream, file, or webcam)
    source = int(args.source) if args.source.isdigit() else args.source
    print(f"🎥 Connecting to stream source: {source}")
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"❌ Error: Unable to open video source: {source}")
        print("💡 Tips for Dahua RTSP:")
        print("   Format: rtsp://<admin>:<password>@<ip_address>:554/cam/realmonitor?channel=1&subtype=0")
        return

    # Set camera buffer to reduce latency
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

    prev_time = time.time()
    print("🚀 Monitoring started. Press 'q' to quit.")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            print("Video stream ended or disconnected.")
            break

        # Inference with YOLO11
        results = model.predict(source=frame, conf=args.conf, imgsz=args.imgsz, verbose=False)
        annotated_frame = results[0].plot()

        # Extract detected class labels
        boxes = results[0].boxes
        detected_labels = [model.names[int(box.cls)].lower() for box in boxes]

        # Security Alert Banner logic
        alert_y = 35
        if any("person" in lbl for lbl in detected_labels):
            cv2.rectangle(annotated_frame, (10, alert_y - 25), (420, alert_y + 10), (0, 0, 180), -1)
            cv2.putText(annotated_frame, "ALERT: Person / Intruder Detected!", 
                        (15, alert_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            alert_y += 40

        if any("package" in lbl for lbl in detected_labels):
            cv2.rectangle(annotated_frame, (10, alert_y - 25), (440, alert_y + 10), (0, 140, 255), -1)
            cv2.putText(annotated_frame, "NOTICE: Package Detected at Doorstep!", 
                        (15, alert_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            alert_y += 40

        if any("vehicle" in lbl or "car" in lbl or "motorcycle" in lbl for lbl in detected_labels):
            cv2.rectangle(annotated_frame, (10, alert_y - 25), (380, alert_y + 10), (180, 100, 0), -1)
            cv2.putText(annotated_frame, "Vehicle Detected Near Perimeter", 
                        (15, alert_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # FPS Counter
        current_time = time.time()
        fps = 1.0 / (current_time - prev_time + 1e-6)
        prev_time = current_time
        cv2.putText(annotated_frame, f"FPS: {fps:.1f}", (annotated_frame.shape[1] - 140, 35), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        # Display output window
        cv2.imshow("Dahua CCTV Smart Security Stream (YOLO11)", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("🛑 Stream closed.")

if __name__ == "__main__":
    main()
