import http.server
import os
import socket
import threading

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)
PORT = 8084


class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.svg': 'image/svg+xml',
        '.wasm': 'application/wasm',
        '.js': 'application/javascript',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()


class IPv6ThreadingHTTPServer(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    allow_reuse_address = False


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = False
    try:
        server_v4 = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHTTPRequestHandler)
    except Exception as e:
        print(f"Puerto {PORT} ocupado ({e}), probando 8092...", flush=True)
        PORT = 8092
        server_v4 = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHTTPRequestHandler)

    try:
        server_v6 = IPv6ThreadingHTTPServer(("::1", PORT), NoCacheHTTPRequestHandler)
        threading.Thread(target=server_v6.serve_forever, daemon=True).start()
    except Exception:
        pass

    print(f"KIKES HUEVO PWA CEL (Seccional Cauca Móvil) iniciado en http://localhost:{PORT}", flush=True)
    server_v4.serve_forever()
