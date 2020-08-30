const fs = require('fs');

const base_filepath = "../data_files/base.html"
const save_filepath = "../data_files/save_data.txt"
const spec_filepath = "../data_files/special_dates.txt"
const script_filepath = "./scripts.js"
const style_filepath = "../stylesheets/timers.css"

/*
  this reads from the special_dates file - synchronous - and uses the data to create an array
  and the html for the dropdown then returns an object containg both
*/
function generateSpecDateData() {
  let html = `<input list="special_days" onchange="addDropdownDateToInput()" id="dropdown">
  <datalist id="special_days">\n`

  let content = String(fs.readFileSync(spec_filepath))
  let lines = content.split("\n")

  for(i = 0; i < lines.length; i++) {
    let current = lines[i]
    if(current == "") break;
    else {
      parts = current.split("-")
      let date = parts[1].slice(0,5) //removes the \r from the end of each date
      let name = parts[0]
      let add = `   <option label="${name}" value="${date}">\n`
      html = html.concat(add)
    }
  }
  let add = ` </datalist>
</input>`

  html = html.concat(add)

  return html
}

/*
  takes the html buffer and converts it to a String
  - is a function to improve understanding of handle get
*/
function htmlToString(html) {
  let strHtml = String( html )

  return strHtml
}

/*
  reads asynchronously from the specified file
  and uses the data in the given callback
*/
function readContent(filename, callback) {
  fs.readFile(filename,
  (err, contents) => {
    if( err ) callback(err)
    else callback(null, contents)
  }
);
}

/*
  the function which handles the different types of GET request the server gets from the client
*/
async function handleGet(req, res) {
  	console.log('get: ' + req.url);

    if(req.url.endsWith(".js")){
      console.log("fetching a script file")
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      let content = readContent(script_filepath, (err, contents) => {
        if(err) {
          console.log(err)
          res.end()
        }
        else res.end(contents);
      });
    }
    else if(req.url.endsWith(".css")) {
      console.log("fetching a stylesheet")
      res.writeHead(200, {"Content-Type" : "text/css"});
      let content = readContent(style_filepath, (err, contents) => {
        if(err){
          console.log(err)
          res.end()
        }
        else res.end(contents)
      });
    }
    else{
      console.log("fetching a html file")
    	res.writeHead(200, {'Content-Type': 'text/html'});
      let content = readContent(base_filepath, (err, contents) => {
        if(err) {
          console.log(err)
          res.end()
        }
        else {
          contents = htmlToString(contents) // converts the HTML to String to allow me to add in data from another source
          let specialDaysHTML = generateSpecDateData()
          contents = contents.replace("replaceMe", specialDaysHTML)
          res.end(contents);}
      });
    }
}

/*
  reads the data from the text file that stores the saved dates
  adds it to an object, parses it to a String and then returns it
  - is used by main to genreate a response to send when the client requests the save data
*/
function fetchSaveData(maxSaveCount) {
  let dates = String(fs.readFileSync(save_filepath))
  let lines = dates.split('\n')

  if(lines[lines.length-1] == "") lines.pop() // if the last element is empty pop it

  while(lines.length > maxSaveCount) lines.pop()

  for(i = 0; i < lines.length; i++) {
    lines[i] = lines[i].slice(0,10) //all dates are of length 10, some may have control characters attached, this will remove them
  }

  let resultObj = {"type":"data", "data":{"lines":lines} }
  let resultStr = JSON.stringify(resultObj)
  return resultStr
}

/*
  takes an array and generates a String in the format
  of the save_data.txt file
*/
function convertArrayToSaveFormat(data) {
  let result = ""
  for(i = 0; i < data.length; i++){
    result = result.concat(data[i], "\n")
  }
  return result
}

/*
  reads the save data from the file then due to the way fetchSaveData can cut the save data
  if there is more than the client will accpt re-writes the file with the save data being sent
  before returning the generated response String
*/
function handleRequestForSaveData(maxSaveDataToSend, receivedObj) {
  let resultStr = fetchSaveData(maxSaveDataToSend)
  let lines = JSON.parse(resultStr).data.lines
  let replace = convertArrayToSaveFormat(lines)
  fs.writeFileSync(save_filepath, replace)

  return resultStr
}

/*
  function for handling the client's reqest for a date to be saved
  reads in the save data and parses the responseStr to an object
  removed the array and adds the date sent by the client
  the array is then converted to the saveData format which is then
  overwritten to the saveData file
*/
function handleSaveRequest(maxSaveDataToSend, recievedObj) {
  let saveObj = JSON.parse(fetchSaveData())
  let saveData = saveObj.data.lines
  let toSave = recievedObj.data.date
  saveData.push(toSave)
  let data = convertArrayToSaveFormat(saveData)
  fs.writeFileSync(save_filepath, data)

  let id = recievedObj.data.id
  let date = recievedObj.data.date
  let responseObj = {"type":"saveConfirm", "data":{"date":date, "id":id}}
  let responseStr = JSON.stringify(responseObj)

  return responseStr
}

var toRemove = undefined  //global as the function to filter an array cannot take in a second parameter
/*
  is used to filter the saveData array to remove a certain date
*/
function isNotIt(date) {
  return date != toRemove
}

/*
  reads in the savedata and converts the response to an object
  takes the array from the object and filters it to remove the date
  given by the client then converts that array to the save data format
  this is then used to overwrite the save data file
*/
function handleUnsaveRequest(maxSaveDataToSend, recievedObj) {
  let date = recievedObj.data.date
  toRemove = date
  let saveObj = JSON.parse(fetchSaveData(maxSaveDataToSend))
  let saveData = saveObj.data.lines
  saveData = saveData.filter(isNotIt)
  let data = convertArrayToSaveFormat(saveData)
  fs.writeFileSync(save_filepath, data)

  let id = recievedObj.data.id
  let responseObj = {"type":"unsaveConfirm", "data":{"date":date, "id":id}}
  let responseStr = JSON.stringify(responseObj)

  return responseStr
}

module.exports = {
  htmlToString,
  readContent,
  fetchSaveData,
  convertArrayToSaveFormat,
  isNotIt,
  handleGet,
  handleRequestForSaveData,
  handleSaveRequest,
  handleUnsaveRequest,
  generateSpecDateData
}
