from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

PORT = 8000

ROOT = Path(__file__).resolve().parent

os.chdir(ROOT)


class GobloxVRHandler(SimpleHTTPRequestHandler):

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):

        if self.path == "/health":

            data = b'{"status":"online","app":"Goblox VR"}'

            self.send_response(200)

            self.send_header(
                "Content-Type",
                "application/json"
            )

            self.send_header(
                "Content-Length",
                str(len(data))
            )

            self.end_headers()
            self.wfile.write(data)

            return

        if self.path == "/":
            self.path = "/vr.html"

        return super().do_GET()


if __name__ == "__main__":

    server = ThreadingHTTPServer(
        ("0.0.0.0", PORT),
        GobloxVRHandler
    )

    print("================================")
    print("       GOBLOX VR SERVER")
    print("================================")
    print(f"Local: http://localhost:{PORT}")
    print("Abra /vr.html para iniciar.")
    print("================================")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("Servidor encerrado.")
        server.server_close()
