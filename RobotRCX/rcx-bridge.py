#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RCX-Bridge fuer CodeON
======================
Kleiner lokaler Dienst, der die Bruecke zwischen dem Browser (Open Roberta /
CodeON Lab) und dem LEGO RCX ueber den Infrarot-Tower schlaegt.

Warum das noetig ist:
  Der Browser darf aus Sicherheitsgruenden keine Programme auf dem Rechner
  starten. WebUSB scheitert auf macOS am blockierten controlTransferIn. Das
  klassische Tool `nqc` spricht den USB-Tower aber ueber den nativen
  Betriebssystem-Treiber an - genau das machen wir hier.

Ablauf:
  Lab kompiliert das NEPO-Programm zu einer .rcx-Datei (base64 in der
  Server-Antwort) -> Frontend schickt sie per HTTP an diese Bridge ->
  Bridge ruft `nqc -Susb -d programm.rcx` auf -> RCX ist bespielt.

Start:
  python3 rcx-bridge.py
  (laeuft dann dauerhaft, Fenster offen lassen)

Keine Fremdbibliotheken noetig - nur Python 3 Standardbibliothek.
"""

import base64
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

# ----------------------------------------------------------------------------
# Konfiguration
# ----------------------------------------------------------------------------
BRIDGE_PORT = 2222
MAX_REQUEST_BYTES = 1024 * 1024
MAX_PROGRAM_BYTES = 256 * 1024

# Reihenfolge der Kandidaten, wo nqc gesucht wird. Der erste Treffer gewinnt.
# 1. Umgebungsvariable NQC_PATH (falls gesetzt)
# 2. Mitgelieferte Binary neben diesem Skript (./bin/nqc)
# 3. nqc im System-PATH
def find_nqc():
    env = os.environ.get("NQC_PATH")
    if env and os.path.isfile(env) and os.access(env, os.X_OK):
        return env
    here = os.path.dirname(os.path.abspath(__file__))
    local = os.path.join(here, "bin", "nqc")
    if os.path.isfile(local) and os.access(local, os.X_OK):
        return local
    found = shutil.which("nqc")
    if found:
        return found
    return None


def find_firmware():
    """Find a user-provided standard LEGO RCX firmware image."""
    configured = os.environ.get("RCX_FIRMWARE_PATH")
    candidates = [configured] if configured else []
    firmware_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firmware")
    candidates += [
        os.path.join(firmware_dir, "FIRM0332.LGO"),
        os.path.join(firmware_dir, "FIRM0328.LGO"),
        os.path.join(firmware_dir, "firm0332.lgo"),
        os.path.join(firmware_dir, "firm0328.lgo"),
    ]
    return next((path for path in candidates if path and os.path.isfile(path)), None)


# nqc-Aufrufparameter je nach Betriebssystem. Der USB-Tower nutzt auf allen
# unterstuetzten Systemen den speziellen -Susb-Modus. Serielle Tower brauchen
# stattdessen den Geraetepfad (siehe Kommentar unten).
def nqc_serial_args():
    system = platform.system()
    # USB-Tower: -Susb funktioniert auf macOS (getestet: Tower leuchtet) und Windows.
    # Unter Linux wird der USB-Tower ueber /dev/usb/legousbtower0 angesprochen.
    if system == "Linux":
        dev = "/dev/usb/legousbtower0"
        if os.path.exists(dev):
            return ["-S" + dev]
        return ["-Susb"]
    # macOS + Windows:
    return ["-Susb"]

    # --- Serieller Tower (falls jemand statt USB einen seriellen Tower nutzt) ---
    # macOS:   ["-S/dev/cu.usbserial-XXXX"]
    # Linux:   ["-S/dev/ttyUSB0"]
    # Windows: ["-SCOM1"]


# ----------------------------------------------------------------------------
# Uebertragungslogik
# ----------------------------------------------------------------------------
def transfer_rcx(rcx_bytes, program_slot=1, run_after=False):
    """
    Schreibt die uebergebenen .rcx-Bytes in eine temporaere Datei und ruft
    nqc auf, um sie auf den RCX zu uebertragen. Gibt
    (ok, meldung, fehlercode) zurueck.
    """
    nqc = find_nqc()
    if not nqc:
        return False, ("nqc wurde nicht gefunden. Lege die kompilierte Binary "
                       "nach ./bin/nqc oder setze die Umgebungsvariable NQC_PATH."), "nqc_missing"

    tmpdir = tempfile.mkdtemp(prefix="rcx-bridge-")
    rcx_path = os.path.join(tmpdir, "programm.rcx")
    proc = None
    try:
        with open(rcx_path, "wb") as f:
            f.write(rcx_bytes)

        # Korrekte Syntax für NQC 4.1.0 zum Flashen von .rcx-Binärdateien via USB:
        # options: -Susb
        # action: -d (download)
        # file: rcx_path
        # actions after file: -pgm (program slot), -run (optional execution)
        cmd = [nqc] + nqc_serial_args() + ["-d", rcx_path, "-pgm", str(program_slot)]

        if run_after:
            cmd += ["-run"]

        print("[RCX-Bridge] Running command:", " ".join(cmd))
        
        # Popen verwenden, um den Prozess bei Timeout sauber beenden zu koennen
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            stdout_bytes, stderr_bytes = proc.communicate(timeout=20)
            returncode = proc.returncode
            out = (stdout_bytes or b"").decode("utf-8", errors="replace") + (stderr_bytes or b"").decode("utf-8", errors="replace")
        except subprocess.TimeoutExpired:
            proc.kill()
            stdout_bytes, stderr_bytes = proc.communicate()
            returncode = proc.returncode or 253
            out = "Zeitueberschreitung bei der Kommunikation mit dem Infrarot-Turm."
            
        print("[RCX-Bridge] NQC exit code:", returncode)
        print("[RCX-Bridge] NQC output:", out.strip())
        
        if returncode == 0:
            msg = "Programm erfolgreich auf den RCX uebertragen."
            if not run_after:
                msg += " Gruenen Run-Knopf am RCX druecken."
            return True, msg + ("\n" + out.strip() if out.strip() else ""), None
        elif "no firmware installed" in out.lower():
            return False, (
                "Auf dem RCX wurde keine Firmware erkannt. Nach deiner Zustimmung kann "
                "CodeON zuerst eine lokal bereitgestellte LEGO-RCX-Firmware übertragen."
            ), "firmware_missing"
        elif returncode == 253:
            return False, (
                "Übertragung fehlgeschlagen: Der RCX-Roboter hat nicht geantwortet (NQC-Fehler 253).\n\n"
                "Bitte stelle sicher, dass:\n"
                "1. der RCX eingeschaltet ist (LCD zeigt Zahlen),\n"
                "2. die Firmware auf dem RCX geladen ist (falls nicht, 'Firmware übertragen' klicken),\n"
                "3. der Infrarot-Turm direkt auf das Empfängerfenster des RCX zeigt (Sichtlinie frei),\n"
                "4. die Batterien des RCX nicht zu schwach sind."
            ), "no_reply"
        else:
            return False, ("Uebertragung fehlgeschlagen (nqc-Code %d).\n%s"
                           % (returncode, out.strip())), "transfer_failed"
    except Exception as e:
        return False, "Interner Fehler bei der Übertragung: %s" % e, "internal_error"
    finally:
        # Sicheres Loeschen der temporaeren Datei und des Verzeichnisses
        shutil.rmtree(tmpdir, ignore_errors=True)


def probe_rcx():
    """Fragt die RCX-Version ab - harmloser Verbindungstest, ueberträgt nichts."""
    nqc = find_nqc()
    if not nqc:
        return False, "nqc nicht gefunden."
    cmd = [nqc] + nqc_serial_args() + ["-getversion"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        out = (proc.stdout or "") + (proc.stderr or "")
        return (proc.returncode == 0), out.strip()
    except Exception as e:
        return False, str(e)


def install_firmware():
    """Install configured LEGO firmware after explicit confirmation in CodeON."""
    nqc = find_nqc()
    firmware = find_firmware()
    if not nqc:
        return False, "nqc wurde nicht gefunden."
    if not firmware:
        return False, (
            "Keine RCX-Firmwaredatei gefunden. Lege FIRM0332.LGO oder FIRM0328.LGO "
            "in RobotRCX/firmware ab oder setze RCX_FIRMWARE_PATH."
        )
    cmd = [nqc] + nqc_serial_args() + ["-firmware", firmware]
    try:
        print("[RCX-Bridge] Installing firmware:", " ".join(cmd))
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        out = ((proc.stdout or "") + (proc.stderr or "")).strip()
        if proc.returncode == 0:
            return True, "Firmware erfolgreich auf den RCX übertragen." + ("\n" + out if out else "")
        return False, "Firmwareübertragung fehlgeschlagen (nqc-Code %d).\n%s" % (proc.returncode, out)
    except subprocess.TimeoutExpired:
        return False, "Zeitüberschreitung bei der Firmwareübertragung."
    except Exception as e:
        return False, "Interner Fehler bei der Firmwareübertragung: %s" % e


# ----------------------------------------------------------------------------
# HTTP-Server
# ----------------------------------------------------------------------------
# Standardmaessig duerfen nur lokal ausgelieferte CodeON-Seiten zugreifen.
# Weitere Urspruenge koennen kommasepariert freigegeben werden, zum Beispiel:
# RCX_BRIDGE_ALLOWED_ORIGINS=https://codeon.example.org
def origin_is_allowed(origin):
    if not origin:
        return True
    parsed = urlsplit(origin)
    if parsed.scheme in ("http", "https") and parsed.hostname in ("127.0.0.1", "localhost", "::1"):
        return True
    configured = os.environ.get("RCX_BRIDGE_ALLOWED_ORIGINS", "")
    return origin in {item.strip() for item in configured.split(",") if item.strip()}


# CORS-Header, damit ein freigegebenes Lab (anderer Port) die Bridge aufrufen darf.
def send_cors(handler, status=200, ctype="application/json"):
    handler.send_response(status)
    handler.send_header("Content-Type", ctype)
    origin = handler.headers.get("Origin")
    if origin and origin_is_allowed(origin):
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write("[RCX-Bridge] " + (fmt % args) + "\n")

    def do_OPTIONS(self):
        send_cors(self, 204 if origin_is_allowed(self.headers.get("Origin")) else 403)

    def do_GET(self):
        # /status  -> Bridge lebt, ist nqc da?
        # /probe   -> RCX-Versionsabfrage (Verbindungstest)
        path = urlsplit(self.path).path
        if path == "/status":
            payload = {
                "ok": True,
                "nqc": find_nqc(),
                "firmwareAvailable": bool(find_firmware()),
                "system": platform.system(),
                "message": "RCX-Bridge laeuft.",
            }
            send_cors(self)
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        elif path == "/probe":
            ok, msg = probe_rcx()
            send_cors(self)
            self.wfile.write(json.dumps({"ok": ok, "message": msg}).encode("utf-8"))
        else:
            send_cors(self, 404)
            self.wfile.write(b'{"ok":false,"message":"unknown endpoint"}')

    def do_POST(self):
        if not origin_is_allowed(self.headers.get("Origin")):
            send_cors(self, 403)
            self.wfile.write(b'{"ok":false,"message":"origin not allowed"}')
            return
        path = urlsplit(self.path).path
        if path == "/firmware":
            ok, msg = install_firmware()
            send_cors(self, 200)
            self.wfile.write(json.dumps({"ok": ok, "message": msg}).encode("utf-8"))
            return
        if path != "/upload":
            send_cors(self, 404)
            self.wfile.write(b'{"ok":false,"message":"unknown endpoint"}')
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise ValueError("Anfrage ist leer oder zu gross")
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
        except Exception as e:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "Ungueltige Anfrage: %s" % e}).encode())
            return

        b64 = data.get("compiledCode") or data.get("data")
        try:
            slot = int(data.get("slot", 1))
        except (TypeError, ValueError):
            slot = 0
        run_after = data.get("run", False)

        if not b64:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "Kein compiledCode in der Anfrage."}).encode())
            return
        if slot not in range(1, 6) or not isinstance(run_after, bool):
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "Programmplatz muss 1 bis 5 sein; run muss true oder false sein."}).encode())
            return

        try:
            rcx_bytes = base64.b64decode(b64, validate=True)
            if not rcx_bytes or len(rcx_bytes) > MAX_PROGRAM_BYTES:
                raise ValueError("Programm ist leer oder zu gross")
        except Exception as e:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "base64-Dekodierung fehlgeschlagen: %s" % e}).encode())
            return

        ok, msg, error = transfer_rcx(rcx_bytes, program_slot=slot, run_after=run_after)
        # Immer 200 OK senden, damit das JSON-Fehlerobjekt im Browser verarbeitet werden kann
        send_cors(self, 200)
        self.wfile.write(json.dumps({"ok": ok, "message": msg, "error": error}).encode("utf-8"))


def main():
    nqc = find_nqc()
    print("=" * 60)
    print(" RCX-Bridge fuer CodeON")
    print("=" * 60)
    print(" System      :", platform.system(), platform.release())
    print(" nqc         :", nqc or "NICHT GEFUNDEN (siehe README)")
    print(" Firmware    :", find_firmware() or "NICHT KONFIGURIERT (optional)")
    print(" nqc-Args    :", " ".join(nqc_serial_args()))
    print(" Port        :", BRIDGE_PORT)
    print(" Endpunkte   : GET /status  GET /probe  POST /upload  POST /firmware")
    print("-" * 60)
    if not nqc:
        print(" WARNUNG: Ohne nqc kann nicht uebertragen werden.")
        print(" Lege die Binary nach ./bin/nqc oder setze NQC_PATH.")
        print("-" * 60)
    print(" Bridge laeuft. Zum Beenden: Strg+C")
    print("=" * 60)
    server = ThreadingHTTPServer(("127.0.0.1", BRIDGE_PORT), BridgeHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBridge beendet.")
        server.shutdown()


if __name__ == "__main__":
    main()
