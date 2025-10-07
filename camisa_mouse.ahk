#Requires AutoHotkey v2.0
#SingleInstance Force
#Warn

; ================== AUTO-EXECUTE ==================
CoordMode "Mouse", "Screen"
CoordMode "Pixel", "Screen"
try DllCall("User32\SetThreadDpiAwarenessContext", "ptr", -4, "ptr")  ; PER_MONITOR_AWARE_V2

iniFile := A_ScriptDir "\camisa_mouse.ini"

; Calibração persistente
global aX := 1.0, aY := 1.0
global bX := 0.0, bY := 0.0

; Calib 2 pontos
global gCalStage := 0
global t1x := 0, t1y := 0, l1x := 0, l1y := 0

; Cor da SETA (ciano), tolerância, raio
global ARROW_RGB := 0x00E5FF
global ARROW_TOL := 30
global SNAP_RADIUS := 24
global ARROW_HINT := 230

; Guard rails calib
global CALIB_EDGE_SAFE   := 30
global CALIB_MAX_DELTA   := 12
global CALIB_COOLDOWN_MS := 1200
global lastCalibTick     := 0

; Flags / automação
global gInF8 := false
global gIsMoving := false
global MOVE_LOCK_MS := 200
global lastMoveTick := 0

global AUTO_FROM_CLIP := true
global lastClipSig := ""

LoadCalib()
OnClipboardChange ClipChanged
SetTimer WatchClipboard, 60
return
; ================== FIM AUTO-EXECUTE ==================


; ================== HOTKEYS ==================

; F8: força pegar coords do clipboard e mover (Ctrl+F8 clica)
F8:: {
    global gInF8, gIsMoving, lastMoveTick, MOVE_LOCK_MS
    gInF8 := true
    gIsMoving := true
    lastMoveTick := A_TickCount
    try {
        if !GetTargetFromClipboard(&tx, &ty) {
            MsgBox "Sem coordenadas (garanta Alt+Shift+M na extensão)."
            return
        }
        ActivateFirefoxAtPoint(tx, ty)
        MoveToCoords(tx, ty)
        if GetKeyState("Ctrl", "P")
            Click "Left"
    } finally {
        gInF8 := false
        SetTimer (() => (gIsMoving := false)), -MOVE_LOCK_MS
    }
}

; F7: calibração simples (offset)
F7:: {
    if !GetTargetFromClipboard(&tx, &ty) {
        MsgBox "Sem coordenadas para calibrar."
        return
    }
    MsgBox "Posicione o mouse no centro da SETA e pressione OK."
    MouseGetPos &mx, &my
    global aX, aY, bX, bY
    aX := 1.0, aY := 1.0
    bX := mx - tx
    bY := my - ty
    SaveCalib()
}

; Shift+F7: calibração completa (escala + offset)
+F7:: {
    global gCalStage, t1x, t1y, l1x, l1y, aX, aY, bX, bY
    if (gCalStage = 0) {
        if !GetTargetFromClipboard(&tx, &ty) {
            MsgBox "Sem coordenadas (1/2)."
            return
        }
        MsgBox "CALIB 1/2`nMouse no centro da SETA e OK."
        MouseGetPos &mx, &my
        t1x := tx, t1y := ty, l1x := mx, l1y := my
        gCalStage := 1
        ToolTip "1º ponto salvo. Vá a outro alvo e Shift+F7.", 20, 40
        SetTimer () => ToolTip(""), -1500
        return
    }
    if (gCalStage = 1) {
        if !GetTargetFromClipboard(&t2x, &t2y) {
            MsgBox "Sem coordenadas (2/2)."
            return
        }
        MsgBox "CALIB 2/2`nMouse no centro da SETA e OK."
        MouseGetPos &l2x, &l2y
        aX := (t2x != t1x) ? (l2x - l1x) / (t2x - t1x) : 1.0
        bX := l1x - aX * t1x
        aY := (t2y != t1y) ? (l2y - l1y) / (t2y - t1y) : 1.0
        bY := l1y - aY * t1y
        gCalStage := 0
        SaveCalib()
        MsgBox "Calib OK`na=(" Round(aX,3) "," Round(aY,3) ")  b=(" Round(bX,1) "," Round(bY,1) ")"
    }
}

; F6: reset calibração
F6:: {
    global aX, aY, bX, bY, gCalStage
    aX := 1.0, aY := 1.0, bX := 0.0, bY := 0.0
    gCalStage := 0
    SaveCalib()
    MsgBox "Calibração zerada."
}

; F9: ver calibração
F9:: {
    global aX, aY, bX, bY
    MsgBox "a=(" aX "," aY ")`nb=(" bX "," bY ")"
}

; F10: liga/desliga automação
F10:: {
    global AUTO_FROM_CLIP
    AUTO_FROM_CLIP := !AUTO_FROM_CLIP
    ToolTip "AUTO_FROM_CLIP: " (AUTO_FROM_CLIP ? "ON" : "OFF"), 20, 20
    SetTimer () => ToolTip(""), -900
}


; ================== CLIPBOARD ==================

ClipChanged(Type) {
    global AUTO_FROM_CLIP, gInF8, gIsMoving
    if !AUTO_FROM_CLIP
        return
    if gInF8 || gIsMoving
        return
    TryHandleClipboard()
}

WatchClipboard() {
    global AUTO_FROM_CLIP, gInF8, gIsMoving, lastMoveTick, MOVE_LOCK_MS
    if !AUTO_FROM_CLIP
        return
    if gInF8 || gIsMoving
        return
    if (A_TickCount - lastMoveTick) < MOVE_LOCK_MS
        return
    TryHandleClipboard()
}

TryHandleClipboard() {
    global lastClipSig
    try {
        raw := Trim(A_Clipboard)
        if (raw = "" || raw = lastClipSig)
            return
        norm := StrReplace(StrReplace(raw, " ", ""), ";", ",")
        if !RegExMatch(norm, "^(-?\d+),(-?\d+)(?:#\d+)?$", &m)
            return
        lastClipSig := raw
        tx := Integer(m[1]), ty := Integer(m[2])
        ActivateFirefoxAtPoint(tx, ty)
        MoveToCoords(tx, ty)
    } catch {
        ; silencioso
    }
}


; ================== CORE ==================

LoadCalib() {
    global aX, aY, bX, bY, iniFile
    try {
        aX := IniRead(iniFile, "calib", "aX", 1.0)
        aY := IniRead(iniFile, "calib", "aY", 1.0)
        bX := IniRead(iniFile, "calib", "bX", 0.0)
        bY := IniRead(iniFile, "calib", "bY", 0.0)
    }
}

SaveCalib() {
    global aX, aY, bX, bY, iniFile
    IniWrite(aX, iniFile, "calib", "aX")
    IniWrite(aY, iniFile, "calib", "aY")
    IniWrite(bX, iniFile, "calib", "bX")
    IniWrite(bY, iniFile, "calib", "bY")
    ; (sem ToolTip)
}


GetTargetFromClipboard(&x, &y) {
    txt := Trim(A_Clipboard)
    norm := StrReplace(StrReplace(txt, " ", ""), ";", ",")
    if RegExMatch(norm, "^(-?\d+),(-?\d+)(?:#\d+)?$", &m) {
        x := Integer(m[1]), y := Integer(m[2])
        return true
    }
    try WinActivate "ahk_exe firefox.exe"
    A_Clipboard := ""
    Send "!+m"
    t0 := A_TickCount
    while (A_TickCount - t0 < 1000) {
        if ClipWait(0.2, 1) {
            txt := Trim(A_Clipboard)
            norm := StrReplace(StrReplace(txt, " ", ""), ";", ",")
            if RegExMatch(norm, "^(-?\d+),(-?\d+)(?:#\d+)?$", &m) {
                x := Integer(m[1]), y := Integer(m[2])
                return true
            }
        }
        Sleep 30
    }
    return false
}

ApplyCalib(x, y, &lx, &ly) {
    global aX, aY, bX, bY
    lx := Round(aX * x + bX)
    ly := Round(aY * y + bY)
}

MoveToCoords(tx, ty) {
    global gIsMoving, lastMoveTick, MOVE_LOCK_MS
    gIsMoving := true
    lastMoveTick := A_TickCount

    ApplyCalib(tx, ty, &lx, &ly)
    if SnapToArrow(&fx, &fy, lx, ly)
        MouseMove fx, fy, 0
    else
        MouseMove lx, ly, 0

    SetTimer (() => (gIsMoving := false)), -MOVE_LOCK_MS
}

ColorNear(c1, c2, tol) {
    if (c1 = "" || c2 = "")
        return false
    try {
        c1 := Integer(c1)
    } catch {
        c1 := -1
    }
    try {
        c2 := Integer(c2)
    } catch {
        c2 := -1
    }
    if (c1 < 0 || c2 < 0)
        return false
    r1 := (c1 >> 16) & 0xFF
    g1 := (c1 >> 8) & 0xFF
    b1 :=  c1        & 0xFF
    r2 := (c2 >> 16) & 0xFF
    g2 := (c2 >> 8) & 0xFF
    b2 :=  c2        & 0xFF
    return (Abs(r1-r2) <= tol) && (Abs(g1-g2) <= tol) && (Abs(b1-b2) <= tol)
}

SafeGetColor(x, y) {
    if (x < 0) x := 0
    if (y < 0) y := 0
    if (x > A_ScreenWidth-1)  x := A_ScreenWidth-1
    if (y > A_ScreenHeight-1) y := A_ScreenHeight-1
    c := -1
    try {
        c := PixelGetColor(x, y, "RGB")
    } catch {
        ; mantém -1
    }
    if (c = "" || c = -1)
        return -1
    try {
        return Integer(c)
    } catch {
        return -1
    }
}

SnapToArrow(&fx, &fy, px, py) {
    global ARROW_RGB, ARROW_TOL, SNAP_RADIUS, bX, bY
    global CALIB_EDGE_SAFE, CALIB_MAX_DELTA, CALIB_COOLDOWN_MS, lastCalibTick
    global ARROW_HINT

    ; 0) já é seta?
    col := SafeGetColor(px, py)
    if (col >= 0 && ColorNear(col, ARROW_RGB, ARROW_TOL+8)) {
        fx := px, fy := py
        return true
    } else {
        found := false
        for offs in [[2,0],[-2,0],[0,2],[0,-2],[3,0],[-3,0],[0,3],[0,-3]] {
            col2 := SafeGetColor(px+offs[1], py+offs[2])
            if (col2 >= 0 && ColorNear(col2, ARROW_RGB, ARROW_TOL+8)) {
                fx := px+offs[1], fy := py+offs[2]
                found := true
                break
            }
        }
        if (found)
            return true
    }

    ; 1) busca ao redor
    if __TrySnapAt(&nx, &ny, px, py, SNAP_RADIUS)
        return __ApplySnap(&fx, &fy, px, py, nx, ny, true)
    ; 2) hint direita
    if __TrySnapAt(&nx, &ny, px + ARROW_HINT, py, Max(SNAP_RADIUS, 36))
        return __ApplySnap(&fx, &fy, px, py, nx, ny, false)
    ; 3) hint esquerda
    if __TrySnapAt(&nx, &ny, px - ARROW_HINT, py, Max(SNAP_RADIUS, 36))
        return __ApplySnap(&fx, &fy, px, py, nx, ny, false)

    fx := px, fy := py
    return false
}

__TrySnapAt(&outX, &outY, cx, cy, radius) {
    x1 := cx - radius, y1 := cy - radius, x2 := cx + radius, y2 := cy + radius
    if (x1 < 0) x1 := 0
    if (y1 < 0) y1 := 0
    if (x2 > A_ScreenWidth)  x2 := A_ScreenWidth
    if (y2 > A_ScreenHeight) y2 := A_ScreenHeight
    outX := 0, outY := 0
    return PixelSearch(&outX, &outY, x1, y1, x2, y2, ARROW_RGB, ARROW_TOL)
}

__ApplySnap(&fx, &fy, px, py, nx, ny, allowPersist := true) {
    global bX, bY, CALIB_EDGE_SAFE, CALIB_MAX_DELTA, CALIB_COOLDOWN_MS, lastCalibTick
    fx := nx, fy := ny

    if !allowPersist
        return true

    nearEdge := (px < CALIB_EDGE_SAFE) || (py < CALIB_EDGE_SAFE)
             || (px > A_ScreenWidth - CALIB_EDGE_SAFE)
             || (py > A_ScreenHeight - CALIB_EDGE_SAFE)
    dx := nx - px, dy := ny - py
    smallDelta := (Abs(dx) <= CALIB_MAX_DELTA) && (Abs(dy) <= CALIB_MAX_DELTA)

    if (!nearEdge && smallDelta) {
        bX += dx, bY += dy
        if (A_TickCount - lastCalibTick >= CALIB_COOLDOWN_MS) {
            lastCalibTick := A_TickCount
            SaveCalib()
        }
    }
    return true
}

ActivateFirefoxAtPoint(x, y) {
    try {
        wins := WinGetList("ahk_exe firefox.exe")
        for hwnd in wins {
            WinGetPos &wx, &wy, &ww, &wh, "ahk_id " hwnd
            if (x >= wx && x < wx + ww && y >= wy && y < wy + wh) {
                WinActivate "ahk_id " hwnd
                Sleep 10
                return true
            }
        }
    } catch {
    }
    return false
}
