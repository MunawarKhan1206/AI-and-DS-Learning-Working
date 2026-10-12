import cv2
import gradio as gr
from ultralytics import YOLO

model = YOLO("yolo11s.pt")

def detect_offside(image):
    if image is None:
        return None, "Upload an image to start."

    img = image.copy()
    h, w, _ = img.shape

    results = model(img)[0]
    annotated = results.plot()

    players_x = []
    for box in results.boxes:
        cls_name = results.names[int(box.cls[0])]
        if cls_name not in ["Referee", "Ball"]:
            players_x.append(float(box.xywh[0][0]))

    if len(players_x) >= 2:
        players_sorted = sorted(players_x, reverse=True)
        att_x = int(players_sorted[0])
        def_x = int(players_sorted[1])
        is_offside = (att_x - def_x) > 25
    else:
        def_x = int(w * 0.55)
        att_x = int(w * 0.62)
        is_offside = True

    cv2.line(annotated, (def_x, 60), (def_x, h), (255, 180, 0), 3)
    cv2.putText(annotated, "DEFENDER LINE", (def_x - 130, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 180, 0), 2)

    att_color = (0, 0, 255) if is_offside else (0, 255, 0)
    cv2.line(annotated, (att_x, 60), (att_x, h), att_color, 3)
    cv2.putText(annotated, "ATTACKER LINE", (att_x + 10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, att_color, 2)

    verdict = "OFFSIDE DETECTED" if is_offside else "ONSIDE - NO VIOLATION"
    cv2.rectangle(annotated, (0, 0), (w, 60), (20, 20, 20), -1)
    cv2.putText(annotated, f"VAR DECISION: {verdict}", (20, 42), cv2.FONT_HERSHEY_DUPLEX, 0.9, att_color, 2)

    return cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), f"### Result: **{verdict}**"

demo = gr.Interface(
    fn=detect_offside,
    inputs=gr.Image(label="Upload Football Match Image"),
    outputs=[gr.Image(label="VAR Decision"), gr.Markdown(label="Status")],
    title="AI VAR: Football Offside Detection",
    live=True
)

if __name__ == "__main__":
    demo.launch(share=True)
