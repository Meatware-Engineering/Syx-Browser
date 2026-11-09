import functools
import http.client
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('syx_server', Path(__file__).resolve().parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass

class FileRequests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='syx-http-')
        cls.root = Path(cls.temp.name)
        (cls.root / 'payload.bin').write_bytes(b'0123456789')
        (cls.root / 'empty.bin').write_bytes(b'')
        (cls.root / 'space%20.bin').write_bytes(b'literal percent name')
        (cls.root / 'space .bin').write_bytes(b'decoded space name')
        server.GAME = cls.root / 'fake-game'
        (server.GAME / 'base' / 'script').mkdir(parents=True)
        (server.GAME / 'SongsOfSyx.jar').write_bytes(b'fake jar fixture')
        (server.GAME / 'base' / 'script' / 'own mod.jar').write_bytes(b'own synthetic module')
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=cls.root))
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()
        cls.temp.cleanup()

    def request(self, path='/payload.bin', headers=None, method='GET'):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port, timeout=3)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def test_ranges(self):
        for value, body, span in [('bytes=0-3',b'0123','0-3'),('bytes=7-',b'789','7-9'),
                                 ('bytes=-3',b'789','7-9'),('bytes=-999',b'0123456789','0-9'),
                                 ('bytes=2-999',b'23456789','2-9'),('Bytes=2-3',b'23','2-3')]:
            with self.subTest(value=value):
                code, headers, data = self.request(headers={'Range':value})
                self.assertEqual((code,data), (206,body))
                self.assertEqual(headers.get('Content-Range'),f'bytes {span}/10')
                self.assertEqual(int(headers['Content-Length']),len(body))

    def test_unsatisfiable(self):
        for value in ('bytes=10-','bytes=20-30','bytes=-0'):
            with self.subTest(value=value):
                code, headers, _ = self.request(headers={'Range':value})
                self.assertEqual(code,416)
                self.assertEqual(headers.get('Content-Range'),'bytes */10')

    def test_full_response_fallback(self):
        for headers in ({'Range':'items=0-3'},{'Range':'bytes=0-1,8-9'},
                        {'Range':'bytes=1-2','If-Range':'"old-version"'},
                        {'Range':'bytes=0-'+('9'*5000)}):
            with self.subTest(kind=next(iter(headers.values()))[:30]):
                code, _, data = self.request(headers=headers)
                self.assertEqual((code,data),(200,b'0123456789'))

    def test_head_ignores_range(self):
        code, headers, data = self.request(headers={'Range':'bytes=2-3'},method='HEAD')
        self.assertEqual((code,headers['Content-Length'],data),(200,'10',b''))
        self.assertNotIn('Content-Range',headers)

    def test_modified_since_precedes_range(self):
        _, headers, _ = self.request()
        code, headers, data = self.request(headers={'Range':'bytes=2-3','If-Modified-Since':headers['Last-Modified']})
        self.assertEqual((code,data),(304,b''))
        self.assertNotIn('Content-Range',headers)

    def test_empty_file(self):
        code, _, data = self.request('/empty.bin',{'Range':'bytes=-3'})
        self.assertEqual((code,data),(200,b''))

    def test_path_decoded_once(self):
        code, _, data = self.request('/space%2520.bin')
        self.assertEqual((code,data),(200,b'literal percent name'))

    def test_game_alias_and_generated_index_use_only_fixtures(self):
        self.assertEqual(self.request('/game.jar',{'Range':'bytes=0-3'})[::2],(206,b'fake'))
        self.assertEqual(self.request('/base/script/index.list')[::2],(200,b'own mod.jar\n'))
        self.assertEqual(self.request('/base/script/own%20mod.jar')[::2],(200,b'own synthetic module'))

if __name__ == '__main__':
    unittest.main()
