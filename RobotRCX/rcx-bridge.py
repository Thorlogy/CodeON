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

# ----------------------------------------------------------------------------
# Konfiguration
# ----------------------------------------------------------------------------
BRIDGE_PORT = 2222

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
    nqc auf, um sie auf den RCX zu uebertragen. Gibt (ok, meldung) zurueck.
    """
    nqc = find_nqc()
    if not nqc:
        return False, ("nqc wurde nicht gefunden. Lege die kompilierte Binary "
                       "nach ./bin/nqc oder setze die Umgebungsvariable NQC_PATH.")

    tmpdir = tempfile.mkdtemp(prefix="rcx-bridge-")
    rcx_path = os.path.join(tmpdir, "programm.rcx")
    try:
        with open(rcx_path, "wb") as f:
            f.write(rcx_bytes)

        # nqc-Kommando zusammenbauen:
        #   nqc -Susb -b -pgm <slot> -d programm.rcx   (und optional -run)
        #   -b            : Eingabedatei ist bereits Binaerdatei (nicht kompilieren)
        #   -pgm <slot>   : Programmplatz 1..5 auf dem RCX
        #   -d            : an den RCX senden (download)
        #   -run          : direkt nach dem Download starten
        # Korrekte Syntax für NQC 4.1.0 zum Flashen von .rcx-Binärdateien via USB
        cmd = [nqc, "-Susb"]

        if run_after:
            # Lädt das Binary hoch und startet es sofort auf dem RCX (-r)
            cmd += ["-r", rcx_path]
        else:
            # Lädt das Binary nur hoch, ohne es direkt zu starten (-b)
            cmd += ["-b", rcx_path]

        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        out = (proc.stdout or "") + (proc.stderr or "")
        if proc.returncode == 0:
            msg = "Programm erfolgreich auf den RCX uebertragen."
            if not run_after:
                msg += " Gruenen Run-Knopf am RCX druecken."
            return True, msg + ("\n" + out.strip() if out.strip() else "")
        else:
            return False, ("Uebertragung fehlgeschlagen (nqc-Code %d).\n%s"
                           % (proc.returncode, out.strip()))
    except subprocess.TimeoutExpired:
        return False, ("Zeitueberschreitung. Ist der RCX eingeschaltet, hat er "
                       "Firmware und steht er direkt vor dem Tower?")
    except Exception as e:
        return False, "Interner Fehler: %s" % e
    finally:
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


# ----------------------------------------------------------------------------
# HTTP-Server
# ----------------------------------------------------------------------------
# CORS-Header, damit das Lab (anderer Port) die Bridge aufrufen darf.
def send_cors(handler, status=200, ctype="application/json"):
    handler.send_response(status)
    handler.send_header("Content-Type", ctype)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write("[RCX-Bridge] " + (fmt % args) + "\n")

    def do_OPTIONS(self):
        send_cors(self, 204)

    def do_GET(self):
        # /status  -> Bridge lebt, ist nqc da?
        # /probe   -> RCX-Versionsabfrage (Verbindungstest)
        if self.path.startswith("/status"):
            payload = {
                "ok": True,
                "nqc": find_nqc(),
                "system": platform.system(),
                "message": "RCX-Bridge laeuft.",
            }
            send_cors(self)
            self.wfile.write(json.dumps(payload).encode("utf-8"))
        elif self.path.startswith("/probe"):
            ok, msg = probe_rcx()
            send_cors(self)
            self.wfile.write(json.dumps({"ok": ok, "message": msg}).encode("utf-8"))
        else:
            send_cors(self, 404)
            self.wfile.write(b'{"ok":false,"message":"unknown endpoint"}')

    def do_POST(self):
        if not self.path.startswith("/upload"):
            send_cors(self, 404)
            self.wfile.write(b'{"ok":false,"message":"unknown endpoint"}')
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            data = json.loads(raw.decode("utf-8"))
        except Exception as e:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "Ungueltige Anfrage: %s" % e}).encode())
            return

        # Das Frontend schickt die kompilierte .rcx als base64 im Feld "compiledCode".
        b64 = data.get("compiledCode") or data.get("data")
        slot = int(data.get("slot", 1))
        run_after = bool(data.get("run", False))

        if not b64:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "Kein compiledCode in der Anfrage."}).encode())
            return

        try:
            rcx_bytes = base64.b64decode(b64)
        except Exception as e:
            send_cors(self, 400)
            self.wfile.write(json.dumps(
                {"ok": False, "message": "base64-Dekodierung fehlgeschlagen: %s" % e}).encode())
            return

        ok, msg = transfer_rcx(rcx_bytes, program_slot=slot, run_after=run_after)
        send_cors(self, 200 if ok else 500)
        self.wfile.write(json.dumps({"ok": ok, "message": msg}).encode("utf-8"))


def main():
    nqc = find_nqc()
    print("=" * 60)
    print(" RCX-Bridge fuer CodeON")
    print("=" * 60)
    print(" System      :", platform.system(), platform.release())
    print(" nqc         :", nqc or "NICHT GEFUNDEN (siehe README)")
    print(" nqc-Args    :", " ".join(nqc_serial_args()))
    print(" Port        :", BRIDGE_PORT)
    print(" Endpunkte   : GET /status  GET /probe  POST /upload")
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
