module.exports = {
  apps : [{
    name: "mediasoup-react-client-build",
    cwd: "client",
    script: "npm",
    args: "run build:watch",
  }, {
    name: "mediasoup-react-client-serve",
    cwd: "client",
    script: "npm",
    args: "run serve",
  }, {
    name: "mediasoup-react-server-start",
    cwd: "server",
    script: "npm",
    args: "start",
    env: {
      "DEBUG": "mediasoup:*"
    }
  }]
}
