const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    server.on('error', (err) => {
      console.error('Server failed to start:', err);
    });

    server.listen(port, hostname, () => {
      console.log(`\n✓ Server running at http://${hostname}:${port}`);
      console.log(`✓ Access locally at http://localhost:${port}`);
      console.log(`✓ Access on network at http://172.28.91.10:${port}, http://10.91.1.48:${port}, http://10.91.1.49:${port} or http://10.91.1.21:${port}\n`);
    });
  })
  .catch((err) => {
    console.error('Next.js app failed to prepare:', err);
    process.exit(1);
  });
