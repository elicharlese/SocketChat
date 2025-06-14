const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")
const { SocketService } = require("./lib/socket-server")

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("Internal Server Error")
    }
  })

  // Initialize Socket.io
  SocketService.initIO(server)

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})

