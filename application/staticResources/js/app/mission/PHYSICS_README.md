# NEPO 3D – Simulationsphysik Dokumentation

## Versions-Übersicht

| Datei | Version | Datum | Beschreibung |
|---|---|---|---|
| `mission-sim3d.v1-keyframe.js` | v1 – Keyframe | 2026-02-20 | Lineare Interpolation, Ease-in-out |
| `mission-sim3d.js` | v2 – DiffDrive | 2026-02-20 | Differentialantrieb-Kinematik |

---

## V1: Keyframe-Interpolation (Fallback / Backup)

**Datei:** `mission-sim3d.v1-keyframe.js`

### Funktionsprinzip

```
Befehl: drive 30cm bei 50% Speed
│
├── Zielposition direkt berechnet: (x+dx, z+dz)
├── Animationsdauer: |dist| × 60ms/cm × (50/speed)
└── Frame-Update: pos = lerp(start, target, ease(t))
      wobei ease(t) = quadratische Ease-in-out Kurve
```

### Stärken
- Einfach und stabil
- Vorhersehbare, exakt reproduzierbare Bewegung
- Kein Drift, kein Akkumulationsfehler

### Schwächen
- Keine echte Raddynamik – Roboter teleportiert quasi von A nach B
- Drehen und Fahren sind komplett getrennte Befehle (kein Bogen möglich)
- Ease-in-out ist rein kosmetisch, hat kein physikalisches Fundament
- Kollision: erst binäre Suche für Kontaktpunkt, dann Motor-Stall über verbleibende Zeit

### Kollision (V1)
1. Jedes Frame: AABB-Check der neuen Position
2. Bei Treffer: Binärsuche (12 Iterationen) → exakter Kontaktpunkt
3. Roboter bleibt dort, Räder drehen weiter für verbleibende Animationszeit (Motor-Stall-Simulation)
4. Nach Ablauf der Zeit: nächster Befehl

---

## V2: Differentialantrieb-Kinematik (aktuell)

**Datei:** `mission-sim3d.js`

### Das Differentialantrieb-Modell

Ein EV3-Roboter hat zwei angetriebene Räder (L und R) und eine passives Stützrad.
Die Bewegung ergibt sich aus der Differenz der Geschwindigkeiten beider Räder:

```
Physikalische Größen:
  WHEEL_RADIUS  = 0.0275 m  (EV3 großes Rad = 55mm Durchmesser)
  WHEEL_BASE    = 0.115 m   (Abstand zwischen den Rädern ≈ 11.5cm)

Pro Frame (dt Sekunden):
  ωL = linke Radwinkelgeschwindigkeit  [rad/s]
  ωR = rechte Radwinkelgeschwindigkeit [rad/s]

  vL = ωL × WHEEL_RADIUS  → lineare Geschwindigkeit linkes Rad [m/s]
  vR = ωR × WHEEL_RADIUS  → lineare Geschwindigkeit rechtes Rad [m/s]

  v     = (vL + vR) / 2           → Vorwärtsgeschwindigkeit Roboterzentrum
  omega = (vR - vL) / WHEEL_BASE  → Drehrate [rad/s]

  x     += v × (-sin θ) × dt      → Three.js: vorwärts = -sin/−cos
  z     += v × (-cos θ) × dt
  θ     += omega × dt             → Heading-Update
```

### Befehle & Rad-Mapping

**drive forwards/backwards:**
```
  ωL = ωR = speed_radsec  (beide gleich → Geradeausfahrt)
  speed_radsec = (speedPct/100) × MAX_RAD_PER_SEC
  Abbruch: wenn zurückgelegte Strecke ≥ distanceCm × UNIT
```

**turn right (positiv) / left (negativ):**
```
  ωL = +speed_radsec   (links schneller)
  ωR = -speed_radsec   (rechts rückwärts)
  → In-place rotation (Pivotturn wie EV3 standard)
  Abbruch: wenn |Δθ| ≥ |degrees × π/180|
```

### Beschleunigungsrampe

Der EV3 hat eine konfigurierbare Rampe. Wir simulieren:
```
  t_ramp = 0.3s  (Anlaufzeit)
  rampFactor = min(elapsed / t_ramp, 1.0)
  ω_eff = ω_target × rampFactor
```

### Kollision (V2)
1. Jedes Frame: Position tentativ berechnen
2. AABB-Check der neuen Position
3. Bei Treffer: Nur Translationskomponente blockieren, Rotation weiterläuft
4. Motor-Stall: Räder drehen weiter bis Target-Distanz "logisch" erreicht

### Echte EV3-Werte (Referenz)
| Parameter | EV3 Real | Simulation |
|---|---|---|
| Rad-Ø groß | 56 mm | 0.056 m |
| Achsabstand | ~115 mm | 0.115 m |
| Max Drehzahl | ~170 rpm = ~17.8 rad/s | MAX_RAD_PER_SEC = 17.8 |
| 100% Speed | ~0.5 m/s | 17.8 × 0.028 ≈ 0.5 m/s ✓ |

---

## Coordinate System

```
Three.js Koordinatensystem (Y oben):

        -Z (Robot forward at theta=0)
         │
    -X ──┼── +X
         │
        +Z  (Robot start)

Robot rotation.y: negativ = Rechtsdrehung (clockwise blick von oben)
```

## Zu den Physik-Bibliotheken (Three.js Journey Empfehlung)

Das Three.js Journey Kursmaterial empfiehlt **Cannon-es** oder **Rapier** für
vollständige Rigidbody-Physik (Schwerkraft, Kräfte, Impulse, Joints). Für unseren
Anwendungsfall (bodengebundener Roboter, keine Sprünge, keine komplexe Gelenkmechanik)
wäre das Overkill. Die Differential-Drive-Kinematik (V2) implementiert das physikalisch
korrekte Modell für genau diesen Robotertyp ohne externen Overhead.

Falls in Zukunft Sensor-Simulation (Ultraschall, Licht), Bodenunebenheiten oder
Kollisions-Bouncing benötigt werden, könnte Rapier als Engine eingebunden werden.
