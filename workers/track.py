import json
import math
import sys
import cv2
import numpy as np

filename, start, end = sys.argv[1:4]
focus_mode = sys.argv[4] if len(sys.argv) > 4 else "auto"
start, end = float(start), float(end)

if focus_mode in ("left", "kiri"):
    pts = [[tick / 2, 0.25, 0.36] for tick in range(max(1, math.ceil((end - start) * 2)))]
    print(json.dumps(pts))
    sys.exit(0)
if focus_mode in ("right", "kanan"):
    pts = [[tick / 2, 0.75, 0.36] for tick in range(max(1, math.ceil((end - start) * 2)))]
    print(json.dumps(pts))
    sys.exit(0)
if focus_mode in ("center", "tengah"):
    pts = [[tick / 2, 0.50, 0.40] for tick in range(max(1, math.ceil((end - start) * 2)))]
    print(json.dumps(pts))
    sys.exit(0)

cap = cv2.VideoCapture(filename)
frontal_default = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
frontal_alt2 = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml")
profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")

SW = 480
raw_detections = []
prev_gray = None

total_ticks = max(1, math.ceil((end - start) * 2))

for tick in range(total_ticks):
    sec = tick / 2.0
    cap.set(cv2.CAP_PROP_POS_MSEC, (start + sec) * 1000.0)
    ok, image = cap.read()
    if not ok or image is None:
        raw_detections.append((sec, False, []))
        continue

    h, w = image.shape[:2]
    sh = max(32, round(SW * h / w))
    small = cv2.resize(image, (SW, sh))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    ycrcb = cv2.cvtColor(small, cv2.COLOR_BGR2YCrCb)

    # Masker warna kulit manusia di zona kepala/wajah (y: 8% .. 54% tinggi frame, mengabaikan meja/iPad di bawah)
    skin_mask = cv2.inRange(ycrcb, (35, 134, 77), (255, 180, 130))
    skin_mask[int(sh * 0.55):, :] = 0
    skin_mask[:int(sh * 0.06), :] = 0

    is_scene_cut = False
    if prev_gray is not None and prev_gray.shape == gray.shape:
        diff = cv2.absdiff(gray, prev_gray)
        # Jika seluruh frame berubah drastis (mean diff > 16), itu adalah perpindahan kamera di video sumber
        if float(np.mean(diff)) > 16.0:
            is_scene_cut = True
            motion_mask = np.zeros_like(gray, dtype=np.uint8)
        else:
            motion_mask = (diff > 10).astype(np.uint8)
    else:
        motion_mask = np.zeros_like(gray, dtype=np.uint8)
    prev_gray = gray

    # 1. Deteksi multi-cascade: frontal + alt2 + profile kiri + profile kanan (flip)
    min_face = max(34, int(SW * 0.075))
    boxes = []
    for det, sf, mn in ((frontal_default, 1.12, 4), (frontal_alt2, 1.12, 4), (profile_cascade, 1.12, 4)):
        found = det.detectMultiScale(gray, sf, mn, minSize=(min_face, min_face))
        for (l, t_y, fw, fh) in found:
            boxes.append((int(l), int(t_y), int(fw), int(fh)))

    flipped_gray = cv2.flip(gray, 1)
    found_flip = profile_cascade.detectMultiScale(flipped_gray, 1.12, 4, minSize=(min_face, min_face))
    for (l, t_y, fw, fh) in found_flip:
        real_l = SW - int(l) - int(fw)
        boxes.append((real_l, int(t_y), int(fw), int(fh)))

    merged = []
    for b in sorted(boxes, key=lambda item: item[2] * item[3], reverse=True):
        l, t_y, fw, fh = b
        cx = (l + fw * 0.5) / SW
        cy = (t_y + fh * 0.5) / sh
        # Wajah pembicara selalu berada di zona atas-tengah (0.10 .. 0.56)
        if cy < 0.10 or cy > 0.56:
            continue
        if any(abs(cx - m[0]) < 0.10 and abs(cy - m[1]) < 0.12 for m in merged):
            continue
        merged.append((cx, cy, l, t_y, fw, fh))

    candidates = []
    for (cx, cy, l, t_y, fw, fh) in merged:
        y0, y1 = max(0, t_y), min(sh, int(t_y + fh * 1.2))
        x0, x1 = max(0, l), min(SW, l + fw)
        face_skin = float(np.mean(skin_mask[y0:y1, x0:x1] > 0)) if y1 > y0 and x1 > x0 else 0.0

        by1 = min(sh, int(t_y + fh * 2.4))
        bx0, bx1 = max(0, int(l - fw * 0.35)), min(SW, int(l + fw * 1.35))
        body_motion = float(np.mean(motion_mask[y0:by1, bx0:bx1])) if by1 > y0 and bx1 > bx0 else 0.0

        # Tolak poster dinding statis (rasio kulit rendah atau kotak wajah kecil tanpa gerakan bicara)
        if face_skin < 0.12 and body_motion < 0.015:
            continue
        if (fw / SW) < 0.10 and body_motion < 0.008 and face_skin < 0.24:
            continue

        size_score = (fw / SW) * 2.4
        motion_score = body_motion * 15.0
        skin_score = face_skin * 1.6
        total_score = size_score + motion_score + skin_score
        target_y = min(0.50, max(0.24, (t_y + fh * 0.60) / sh))
        candidates.append({
            "cx": float(cx),
            "cy": float(target_y),
            "score": float(total_score),
            "motion": float(body_motion),
            "source": "face",
        })

    # 2. Fallback Saliency Kepala Pembicara (Kulit di zona kepala y: 10%..52% + gerakan tubuh)
    head_y1 = int(sh * 0.52)
    col_skin = np.mean(skin_mask[:head_y1, :] > 0, axis=0)
    col_motion = np.mean(motion_mask[:int(sh * 0.72), :], axis=0)
    win = max(24, int(SW * 0.14))
    kernel = np.ones(win) / win
    smooth_skin = np.convolve(col_skin, kernel, mode="same")
    smooth_motion = np.convolve(col_motion, kernel, mode="same")
    speaker_activity = smooth_skin * (1.0 + smooth_motion * 18.0)

    temp_act = speaker_activity.copy()
    edge = int(SW * 0.10)
    temp_act[:edge] = 0
    temp_act[SW - edge:] = 0

    for _ in range(2):
        pk = int(np.argmax(temp_act))
        pk_val = float(temp_act[pk])
        if pk_val < 0.032:
            break
        pk_cx = pk / SW
        if not any(abs(c["cx"] - pk_cx) < 0.12 for c in candidates):
            strip_x0, strip_x1 = max(0, pk - win // 2), min(SW, pk + win // 2)
            skin_rows = np.where(np.mean(skin_mask[:head_y1, strip_x0:strip_x1] > 0, axis=1) > 0.08)[0]
            pk_cy = float(np.clip(np.mean(skin_rows) / sh if len(skin_rows) else 0.34, 0.24, 0.48))
            candidates.append({
                "cx": float(pk_cx),
                "cy": pk_cy,
                "score": float(pk_val * 6.5 + smooth_motion[pk] * 12.0),
                "motion": float(smooth_motion[pk]),
                "source": "skin_motion",
            })
        z0, z1 = max(0, pk - int(SW * 0.22)), min(SW, pk + int(SW * 0.22))
        temp_act[z0:z1] = 0

    raw_detections.append((sec, is_scene_cut, candidates))

cap.release()

all_cands = [c for _, _, cands in raw_detections for c in cands]
if not all_cands:
    print(json.dumps([[tick / 2.0, 0.5, 0.36] for tick in range(total_ticks)]))
    sys.exit(0)

early_cands = [c for sec, _, cands in raw_detections if sec <= 2.5 for c in cands] or all_cands
best_init = max(early_cands, key=lambda c: c["score"])
cur_x = best_init["cx"]
cur_y = best_init["cy"]
last_switch_sec = 0.0
pending_switch_x = None
pending_switch_count = 0

points = []
for tick, (sec, is_scene_cut, cands) in enumerate(raw_detections):
    if cands:
        best_overall = max(cands, key=lambda c: c["score"])
        same_speaker = [c for c in cands if abs(c["cx"] - cur_x) < 0.16]
        best_same = max(same_speaker, key=lambda c: c["score"]) if same_speaker else None

        # Jika terjadi camera cut di video asli, langsung ikuti posisi pembicara di shot baru
        if is_scene_cut:
            cur_x = best_overall["cx"]
            cur_y = best_overall["cy"]
            last_switch_sec = sec
            pending_switch_x = None
            pending_switch_count = 0
        elif best_same is None or (
            abs(best_overall["cx"] - cur_x) >= 0.16
            and best_overall["score"] > best_same["score"] * 1.28
            and (sec - last_switch_sec) >= 1.5
        ):
            if pending_switch_x is not None and abs(best_overall["cx"] - pending_switch_x) < 0.14:
                pending_switch_count += 1
            else:
                pending_switch_x = best_overall["cx"]
                pending_switch_count = 1

            if pending_switch_count >= 2 or best_same is None:
                cur_x = best_overall["cx"]
                cur_y = best_overall["cy"]
                last_switch_sec = sec
                pending_switch_x = None
                pending_switch_count = 0
            elif best_same is not None:
                if abs(best_same["cx"] - cur_x) > 0.025:
                    cur_x = cur_x * 0.72 + best_same["cx"] * 0.28
                if abs(best_same["cy"] - cur_y) > 0.03:
                    cur_y = cur_y * 0.75 + best_same["cy"] * 0.25
        else:
            pending_switch_x = None
            pending_switch_count = 0
            if abs(best_same["cx"] - cur_x) > 0.025:
                cur_x = cur_x * 0.72 + best_same["cx"] * 0.28
            if abs(best_same["cy"] - cur_y) > 0.03:
                cur_y = cur_y * 0.75 + best_same["cy"] * 0.25

    cur_x = float(np.clip(cur_x, 0.16, 0.84))
    cur_y = float(np.clip(cur_y, 0.22, 0.52))
    points.append([round(sec, 2), round(cur_x, 4), round(cur_y, 4)])

print(json.dumps(points))
