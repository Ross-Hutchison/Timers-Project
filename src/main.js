const http = require('http');
const ws = require('ws');  // imports the webSocket functionality
const os = require('os');  // allows for easy access to OS data - the hostname

const server_functions_filepath = "../data_files/server_functions.js"
const functions = require(server_functions_filepath)

var maxSaveDataToSend = undefined   // is defined when th first request for save data is made by the client

const hostName = String(os.hostname).toLowerCase()
let port = 21470

specialDaysData = functions.generateSpecDateData()

var server = http.createServer(
    function(req, res) {
    if(req.method == "GET") {
      functions.handleGet(req, res)
    }
    else if(req.method == "POST") {
      functions.handlePost(req, res)
    }
  }
).listen(port, hostName)

// web server code for bi-directional communication with the client
let wServer = new ws.Server({server:server})
let wsUrl =`ws\\${hostName}:${port}`
console.log(wsUrl)

wServer.on("connection", function(ws) {
  ws.onmessage = function(event) {
    let recievedObj = JSON.parse(event.data)

    if(recievedObj.type == "request") {
      maxSaveDataToSend = recievedObj.data
      let resultStr = functions.handleRequestForSaveData(maxSaveDataToSend, recievedObj);
      ws.send(resultStr)
    }
    else if(recievedObj.type == "saveData"){
      let responseStr = functions.handleSaveRequest(maxSaveDataToSend, recievedObj)
      ws.send(responseStr)
    }
    else if(recievedObj.type == "unsaveData") {
      let responseStr = functions.handleUnsaveRequest(maxSaveDataToSend, recievedObj)
      ws.send(responseStr)
    }
  }
})

console.log("server running")
console.log("hostname: " + hostName)
console.log("port: " + port)
