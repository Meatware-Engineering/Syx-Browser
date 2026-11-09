#!/usr/bin/env python3
"""Serve the local port and the user's installed game on loopback only."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import os
import errno
import re
import shutil
import sys
from io import BytesIO

ROOT = Path(__file__).resolve().parent
GAME = Path.home() / 'Library/Application Support/Steam/steamapps/common/Songs of Syx/SongsOfSyxMac.app/Contents/Resources'


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        url_path = unquote(urlsplit(path).path)
        if url_path == '/game.jar':
            return str(GAME / 'SongsOfSyx.jar')
        if url_path == '/base' or url_path.startswith('/base/'):
            relative = Path(url_path.removeprefix('/base').lstrip('/'))
            if '..' in relative.parts:
                return str(ROOT / '__not_found__')
            return str(GAME / 'base' / relative)
        return super().translate_path(path)

    def send_head(self):
        self.range_length = None
        path = Path(self.translate_path(self.path))
        url_path = unquote(urlsplit(self.path).path)
        if url_path.startswith('/base/') and path.name == 'index.list' and path.parent.is_dir():
            entries = ''.join(f'{entry.name}\n' for entry in sorted(path.parent.iterdir()))
            data = entries.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return BytesIO(data)
        header = self.headers.get('Range')
        # Conditional transfers use the standard handler's full-response/precondition path.
        conditional = any(name in self.headers for name in
                          ('If-Range', 'If-Modified-Since', 'If-None-Match', 'If-Match', 'If-Unmodified-Since'))
        if self.command != 'GET' or conditional or not header or not path.is_file():
            return super().send_head()
        match = re.fullmatch(r'bytes=[ \t]*([0-9]*)-([0-9]*)', header.strip(), re.IGNORECASE)
        if not match or not any(match.groups()):
            return super().send_head()  # Unsupported/multipart ranges can use a full response.
        try:
            first = int(match[1]) if match[1] else None
            last = int(match[2]) if match[2] else None
        except ValueError:
            return super().send_head()  # Very long numerals must not abort the connection.
        try:
            stream = path.open('rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None
        size = os.fstat(stream.fileno()).st_size
        if not size:
            stream.close()
            return super().send_head()
        if first is None:
            start, end = max(0, size - last), size - 1
        else:
            start, end = first, min(last if last is not None else size - 1, size - 1)
        if start >= size or end < start:
            stream.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        stream.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self.range_length = end - start + 1
        return stream

    def copyfile(self, source, outputfile):
        remaining = getattr(self, 'range_length', None)
        if remaining is None:
            return shutil.copyfileobj(source, outputfile)
        while remaining:
            data = source.read(min(65536, remaining))
            if not data:
                break
            outputfile.write(data)
            remaining -= len(data)


if __name__ == '__main__':
    os.chdir(ROOT)
    try:
        server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    except OSError as error:
        if error.errno == errno.EADDRINUSE:
            sys.exit('Порт 8765 занят. Если игра уже запущена, откройте http://127.0.0.1:8765/; иначе остановите приложение, занявшее порт.')
        raise
    print('Откройте http://127.0.0.1:8765/; для остановки нажмите Ctrl+C.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nСервер остановлен.')
    finally:
        server.server_close()
