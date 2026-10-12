# 🏆 AI VAR: Football Offside Detection (Class Presentation)

---

### Slide 1: Introduction
- **Project Title:** AI VAR: Football Offside Detection System
- **Presenter:** [Your Name]
- **Goal:** Real-world Computer Vision project to automate football offside decisions using YOLO11.

---

### Slide 2: Problem Statement
- Referees often make mistakes due to high player speeds and difficult camera angles.
- Manual VAR reviews take 2–3 minutes and interrupt the game.
- **Our Solution:** An automated system that detects players and renders virtual offside lines instantly.

---

### Slide 3: Dataset
- **Dataset:** `Offside Football.v1i.yolo26` (from Roboflow).
- **Entities:** Players, Goalkeeper, Referee, Ball.
- Clean bounding box annotations on real football match frames.

---

### Slide 4: Technology & Model
- **Model:** **YOLO11** (Latest model from Ultralytics).
- **Platform:** Google Colab with NVIDIA GPU.
- **Web App:** Gradio (with live public link).

---

### Slide 5: How It Works
1. User uploads a match frame.
2. YOLO11 detects all players and the ball.
3. System automatically calculates the last defending line and the leading attacker line.
4. Renders the verdict: **OFFSIDE DETECTED** or **ONSIDE**.

---

### Slide 6: Live Project Demo
- Switch to the live web app link (`.gradio.live`).
- Upload a match image and click **Submit**.
- Show the visual VAR line and automatic ruling.

---

### Slide 7: Conclusion & Q&A
- Fast, automated, sub-second offside decision.
- Questions & Answers.
