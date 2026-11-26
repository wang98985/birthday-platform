# -*- coding: utf-8 -*-
"""
生日代码 · 电子版旋转生日蛋糕
由「生日代码平台」为 __NAME__ 生成
直接运行：python birthday_cake.py   （无需安装任何第三方库）
按 Esc 或关闭窗口退出。
"""
import turtle
import math
import random
import time

NAME = "__NAME__"
BIRTHDAY = "__BIRTHDAY__"
WISH = "__WISH__"
SUB = "__SUB__"

W, H = 960, 720
CX, CY = 0, 40
FOCAL = 620
FPS = 25

LAYERS = [
    (158, 72, -58, "#c98a8a", "#f3d9de"),
    (116, 60,   8, "#9fb3c8", "#d9e4f0"),
    ( 78, 52,  66, "#e3c39a", "#f8e9d4"),
]
PLATE = (184, 14, -102, "#b8b8c0", "#e6e6ec")
CANDLE_N = 6
CANDLE_R = 58
CANDLE_H = 46
CANDLE_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#4dabf7", "#f783ac", "#ffa94d"]
BG = "#0b1026"
STAR_COLORS = ["#ffffff", "#ffe9a8", "#a8d8ff", "#ffc4e1", "#c4ffe9"]


def rotate_y(x, y, z, a):
    c, s = math.cos(a), math.sin(a)
    return x * c + z * s, y, -x * s + z * c


def project(p):
    x, y, z = p
    d = FOCAL + z
    if d < 1:
        d = 1
    scale = FOCAL / d
    return CX + x * scale, CY - y * scale, d


def ellipse_pts(radius, yc, a, n=44):
    pts = []
    for i in range(n):
        phi = 2 * math.pi * i / n
        pts.append(project(rotate_y(radius * math.cos(phi), yc,
                                    radius * math.sin(phi), a)))
    return pts


pen = None
stars = []
sparkles = []
angle = 0.0
start_t = 0.0


def fill_poly(pts, color, outline=None):
    pen.penup()
    pen.pencolor(color if outline is None else outline)
    pen.fillcolor(color)
    pen.begin_fill()
    pen.goto(pts[0][0], pts[0][1])
    pen.pendown()
    for x, y, _d in pts[1:]:
        pen.goto(x, y)
    pen.goto(pts[0][0], pts[0][1])
    pen.end_fill()
    pen.penup()


def draw_layer(radius, height, yc, side_col, top_col, a):
    top = ellipse_pts(radius, yc + height / 2, a)
    bot = ellipse_pts(radius, yc - height / 2, a)
    fill_poly(bot + top[::-1], side_col)
    fill_poly(top, top_col, outline=shade(top_col, -18))
    hi = ellipse_pts(radius * 0.62, yc + height / 2 + 0.5, a, n=30)
    fill_poly(hi, shade(top_col, 14))


def shade(hexcol, delta):
    h = hexcol.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    r = max(0, min(255, r + delta))
    g = max(0, min(255, g + delta))
    b = max(0, min(255, b + delta))
    return f"#{r:02x}{g:02x}{b:02x}"


def draw_candle(phi, a, color, t_now, idx):
    top_surface_y = LAYERS[-1][2] + LAYERS[-1][1] / 2
    base_3d = rotate_y(CANDLE_R * math.cos(phi), top_surface_y,
                       CANDLE_R * math.sin(phi), a)
    top_3d = (base_3d[0], base_3d[1] + CANDLE_H, base_3d[2])
    bx, by, d = project(base_3d)
    tx, ty, _ = project(top_3d)
    scale = FOCAL / d
    w = 9 * scale
    pen.penup()
    pen.pencolor(shade(color, -40))
    pen.fillcolor(color)
    pen.begin_fill()
    pen.goto(bx - w / 2, by)
    pen.pendown()
    pen.goto(bx - w / 2, ty)
    pen.goto(bx + w / 2, ty)
    pen.goto(bx + w / 2, by)
    pen.goto(bx - w / 2, by)
    pen.end_fill()
    pen.penup()
    pen.goto(bx, ty)
    pen.pendown()
    pen.pencolor("#3a2a1a")
    pen.pensize(max(1, 1.4 * scale))
    pen.goto(bx, ty - 4 * scale)
    pen.penup()
    pen.pensize(1)
    flick = 1.0 + 0.28 * math.sin(t_now * 13 + idx * 1.7) \
                 + 0.12 * math.sin(t_now * 29 + idx)
    fy = ty - 6 * scale
    pen.goto(bx, fy + 3); pen.dot(16 * scale * flick, "#fff1b8")
    pen.goto(bx, fy);     pen.dot(11 * scale * flick, "#ffd166")
    pen.goto(bx, fy + 1); pen.dot(6.5 * scale * flick, "#ff7a00")
    pen.goto(bx, fy + 1.5); pen.dot(3 * scale * flick, "#fff8dc")
    return d


def draw_plate(a):
    r, h, yc, side_col, top_col = PLATE
    top = ellipse_pts(r, yc + h / 2, a, n=48)
    bot = ellipse_pts(r, yc - h / 2, a, n=48)
    fill_poly(bot + top[::-1], side_col)
    fill_poly(top, top_col, outline=shade(top_col, -20))


def draw_stars(t_now):
    for (x, y, size, color, phase) in stars:
        b = 0.45 + 0.55 * abs(math.sin(t_now * 2.0 + phase))
        r = max(0.5, size * (0.6 + 0.9 * b))
        pen.goto(x, y)
        pen.dot(r * 2, color)


def draw_sparkles(t_now):
    for sp in sparkles:
        sp[0] += sp[2]
        sp[1] += sp[3]
        if sp[1] > H / 2 + 10:
            sp[0] = random.uniform(-W / 2, W / 2)
            sp[1] = -H / 2 - 10
        a = 0.3 + 0.7 * abs(math.sin(t_now * 3 + sp[5]))
        pen.goto(sp[0], sp[1])
        pen.dot(3.2 * a, sp[4])


def draw_text():
    pen.penup()
    try:
        pen.goto(0, 250)
        pen.pencolor("#ffe9a8")
        pen.write("Happy Birthday", align="center", font=("Curlz MT", 40, "bold"))
    except Exception:
        pen.write("Happy Birthday", align="center", font=("Arial", 36, "bold"))
    line = (NAME + "，" if NAME else "") + "生日快乐"
    if BIRTHDAY:
        line += "  ·  " + BIRTHDAY
    pen.goto(0, -210)
    pen.pencolor("#ffe9a8")
    pen.write(line, align="center", font=("微软雅黑", 20, "bold"))
    pen.goto(0, -250)
    pen.pencolor("#cfe3ff")
    pen.write(WISH, align="center", font=("微软雅黑", 14, "normal"))
    if SUB:
        pen.goto(0, -292)
        pen.pencolor("#ffc4e1")
        pen.write(SUB, align="center", font=("微软雅黑", 11, "italic"))


def setup_scene():
    global pen, stars, sparkles, start_t
    screen = turtle.Screen()
    screen.setup(W, H)
    screen.title("生日蛋糕 — 旋转 / Esc 退出")
    screen.bgcolor(BG)
    screen.tracer(0, 0)
    screen.listen()
    screen.onkey(screen.bye, "Escape")
    pen = turtle.Turtle()
    pen.hideturtle()
    pen.speed(0)
    pen.penup()
    random.seed(7)
    stars = [(random.uniform(-W / 2, W / 2), random.uniform(-H / 2, H / 2),
              random.uniform(1.0, 2.8), random.choice(STAR_COLORS),
              random.uniform(0, 6.28)) for _ in range(180)]
    sparkles = [[random.uniform(-W / 2, W / 2), random.uniform(-H / 2, H / 2),
                 random.uniform(-0.25, 0.25), random.uniform(0.3, 1.0),
                 random.choice(STAR_COLORS), random.uniform(0, 6.28)] for _ in range(26)]
    start_t = time.time()
    return screen


def frame():
    global angle
    t_now = time.time() - start_t
    pen.clear()
    draw_stars(t_now)
    draw_sparkles(t_now)
    draw_plate(angle)
    for (r, h, yc, sc, tc) in LAYERS:
        draw_layer(r, h, yc, sc, tc, angle)
    candles = []
    for i in range(CANDLE_N):
        phi = 2 * math.pi * i / CANDLE_N
        base_3d = rotate_y(CANDLE_R * math.cos(phi),
                           LAYERS[-1][2] + LAYERS[-1][1] / 2,
                           CANDLE_R * math.sin(phi), angle)
        d = project(base_3d)[2]
        candles.append((d, phi, i))
    candles.sort(reverse=True)
    for d, phi, i in candles:
        draw_candle(phi, angle, CANDLE_COLORS[i % len(CANDLE_COLORS)], t_now, i)
    draw_text()
    pen.getscreen().update()
    angle += math.radians(1.4)
    pen.getscreen().ontimer(frame, int(1000 / FPS))


def main():
    screen = setup_scene()
    frame()
    screen.mainloop()


if __name__ == "__main__":
    main()
