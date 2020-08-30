var countdown
var nextID = 0
var count = 0
var maxTimers = 4 // sets the maximum number of timers
var timers = [] //holds all of the timer objects
var waitingTimers = [] //holds timers that are to be added to the
var saveDataLoaded = false //used to check if updateAddSystem should be called during addTimers


/*
  Verifies that the entered date is of the correct format
  makes later use easier
*/
function verifyFormat() {
  let input = document.getElementById("date_input")
  let dateExp = "^\\d{2}\/\\d{2}\/\\d{4}$"
  dateCheck = new RegExp(dateExp)

  if(!dateCheck.test(input.value)) {
    alert("invalid please enter in the specified format")
    input.value = ""
  }
}

/*
  this is called when a save or unsave request is sent
  it alters the html of the save and remove buttons so that
  they cannot be clicked repeatedly
  they are changed back when the response from the server is handled

  TODO - add a timeout that will alter the html back to normal after a set time if no response is recieved
*/
function setTimerToWaiting(id, saved) {
  let timer

  if(saved) timer = document.getElementById(`timer_${id}_saved`)
  else timer = document.getElementById(`timer_${id}`)

  if (timer == null) {
    timer = document.getElementById(`timer_fin_${id}`)
    if(timer == null){
      alert("cannot find timer something has gone wrong")
    } else return //if timer is finished then no need to set to waiting
  }

  let parts = timer.children
  let remove = parts[1] //all timers have the same type of children
  let save = parts[2]

  remove.innerHTML = "waiting for confirmation"
  remove.setAttribute("onclick", `alert("waiting for save confirmation from server")`)
  save.innerHTML = "waiting for confirmation"
  save.setAttribute("onclick", `alert("waiting for save confirmation from server")`)

  //could add a setTimeout here to reset the values to normal if 10 seconds pass without a response
}

/*
  This function sends a message to the server that
  the date of the given timer is to be saved
*/
function sendSaveRequest(id, date) {
  let saved = false
  let requestObj = { "type": "saveData", "data":{"date":date, "id":id} }
  let requestStr = JSON.stringify(requestObj)
  webSocket.send(requestStr)

  setTimerToWaiting(id, saved)
}

/*
  alters the html of the timer specified by the server response
  to allow for unsaving and prevent removal
*/
function processSaveConfirmation(confirmationData) {
  let date = confirmationData.date
  let id = confirmationData.id

  let timer = document.getElementById(`timer_${id}`)
  timer.setAttribute("id", `timer_${id}_saved`)
  let parts = timer.children
  let remove = parts[1] //all timers have the same type of children
  let save = parts[2]

  remove.innerHTML = "remove"
  remove.setAttribute("onclick", `alert("a saved timer must be unsaved before removal")`)
  save.innerHTML = "unsave"
  save.setAttribute("onclick", `sendUnsaveRequest(${id}, "${date}")`)
}

/*
  sends a request to the server to request the removal of a save data
*/
function sendUnsaveRequest(id, date) {
  let saved = true
  let requestObj = { "type":"unsaveData", "data":{"date":date, "id":id} }
  let requestStr = JSON.stringify(requestObj)
  webSocket.send(requestStr)

  setTimerToWaiting(id, saved)
}

function processUnsaveConfirmation(confirmationData) {
  let date = confirmationData.date
  let id = confirmationData.id

  let timer = document.getElementById(`timer_${id}_saved`)
  if(timer != null) {
    timer.setAttribute("id", `timer_${id}`)
    let parts = timer.children
    let remove = parts[1] //all timers have the same type of children
    let save = parts[2]

    remove.innerHTML = "remove"
    remove.setAttribute("onclick", `removeTimer(${id})`)
    save.innerHTML = "save"
    save.setAttribute("onclick", `sendSaveRequest(${id}, "${date}")`)
  }
  else timer = document.getElementById(`timer_fin_${id}`)

  if(timer == null) {
    alert("something has gone wrong with confirming the unsaving of timer for date " + date)
  }
}

/*
  removes a timer from the timers array
  (if it is there) using the id
*/
function removeFromTimers(id) {
  for(i = 0; i < timers.length; i++) {
    let current = timers[i]
    if(current.id == id) {
      timers.splice(i,1)
    }
  }
}


function processSavedTimerData(timer) {
  let id = timer.id
  let saveDate = timer.saveDate
  let wrapper = timer.html

  for(i = 0; i < wrapper.children.length; i++) {
    let child = wrapper.children[i]
    if(child.getAttribute("class") == "b_remove") child.setAttribute("onclick", `alert("a saved timer must be unsaved before removal")`)

    if(child.getAttribute("class") == "b_save") {
      child.setAttribute("onclick", `sendUnsaveRequest(${id}, "${saveDate}")` )
      child.innerHTML = "unsave"
    }
  }

  wrapper.setAttribute("class", "saved_timer")
  wrapper.setAttribute("id", `timer_${id}_saved`)
}

/*
  goes through all the added arrays and waiting arrays
  takes them out one by one and alters their class and id
  to represent the fact they were saved
  as well as the save button to be the unsave button
  and the remove button to a placeholder since saved data must be unsaved before removal
*/
function setTimerHtmlForSaveData() {
  let processed = 0
  let fromWaiting = []
  let fromTimers = []

  while(processed != count) {
    let current
    let wasProcessed

    current = waitingTimers.pop()
    if(current != undefined) {
      processSavedTimerData(current)
      processed++
      fromWaiting.push(current)
    }

     current = timers.pop()
     if(current != undefined) {
       processSavedTimerData(current)
       processed++
       fromWaiting.push(current)
     }
  }

  while(fromWaiting.length != 0) {  // the values are taken out of the arrays for simpler processing but need to be addded back after
    waitingTimers.push(fromWaiting.pop())
  }
  while(fromTimers.length != 0) {
    timers.push(fromTimers.pop())
  }
}

function allowAddition() {

  let inputSec = document.getElementById("input_sec")
  let waitmessage = document.getElementById("wait_message")

  wait_message.style.display = "none"
  inputSec.style.display = "inline"

  saveDataLoaded = true
  updateAddSystem()
}

function addSaveData(data) {
  let lines = data.lines
  for(i = 0; i < lines.length; i++) {
    addTimer(lines[i])
  }

  setTimerHtmlForSaveData()

  allowAddition()
}

/*
  clears the input box
  makes it easier to insert values and causes the placeholder
  to reappear
*/
function clearInput() {
  let input = document.getElementById("date_input")
  input.value = ""
}

/*
  generates an object for the date desired using the input value
*/
function findCountdownTo(desiredDate) {

  try {
    let parts = desiredDate.split("/")

    let year = parseInt(parts[2])
    let month = parseInt(parts[1]) - 1 //months start at 0
    let day = parseInt(parts[0])

    let countdownTo = new Date(year, month, day)

    return  countdownTo
  }
  catch(err) {
    alert("Invalid date: " + err)
    return null
  }
}

/*
  takes in a number of seconds and how many seconds make the desired unit
  returning the remaining seconds
*/
function  timeConversion(seconds, no_secs_in_unit) {
  let calc = seconds / no_secs_in_unit
  let toFind = 0

  if(calc >= 1) {
    if(String(calc).includes('.')) {
      let parts = String(calc).split('.')

      toFind = parseInt(parts[0])

      let remainder = parseFloat("." + parts[1])
      seconds = Math.round(remainder * no_secs_in_unit)

    }
    else {
      seconds = 0
      toFind = calc
    }
  }
  else {
    toFind = 0
  }
  return {"sec": seconds, "res": toFind}
}

/*
  uses the DOM manipulation methods to create a HTML element representing the timer
  adding the date and the id the time data is added later for improved accuracy
*/
function generateTimerHtml(displayDate, id, saveDate) {
// creates the diver representing the whole timer
  let mainDiv = document.createElement("div")
  mainDiv.setAttribute("class", "timer")
  mainDiv.setAttribute("id", `timer_${id}`)

// creates the <p> tag that holds the date being counted down to and adds it to main
  let p_date = document.createElement("p")
  p_date.innerHTML = displayDate
  mainDiv.appendChild(p_date)

// creates the remove button for the timer
  let b_rem = document.createElement("button")
  b_rem.innerHTML = "remove"
  b_rem.setAttribute("onclick", `removeTimer(${id})`)
  b_rem.setAttribute("class", "b_remove")
  mainDiv.appendChild(b_rem)

// creates the save button for the timer
  let b_save = document.createElement("button")
  b_save.innerHTML = "save"
  b_save.setAttribute("onclick", `sendSaveRequest(${id}, "${saveDate}")`)
  b_save.setAttribute("class", "b_save")
  mainDiv.appendChild(b_save)

  // creates the table that that fills the div
  let table = document.createElement("table")
  table.setAttribute("class", "timer_content")

  //creates the heading and fills it
  let heading = document.createElement("tr")

    let h_years = document.createElement("th")
    h_years.innerHTML = "years"
    heading.appendChild(h_years)

    let h_days = document.createElement("th")
    h_days.innerHTML = "days"
    heading.appendChild(h_days)

    let h_hours = document.createElement("th")
    h_hours.innerHTML = "hours"
    heading.appendChild(h_hours)

    let h_minutes = document.createElement("th")
    h_minutes.innerHTML = "mins"
    heading.appendChild(h_minutes)

    let h_seconds = document.createElement("th")
    h_seconds.innerHTML = "secs"
    heading.appendChild(h_seconds)

  // creates the data row and fills it
let data = document.createElement("tr")
    data.setAttribute("class", "time_values")

  let d_years = document.createElement("td")
  d_years.setAttribute("id", `d_years_${id}`)
  data.appendChild(d_years)

  let d_days = document.createElement("td")
  d_days.setAttribute("id", `d_days_${id}`)
  data.appendChild(d_days)

  let d_hours = document.createElement("td")
  d_hours.setAttribute("id", `d_hours_${id}`)
  data.appendChild(d_hours)

  let d_minutes = document.createElement("td")
  d_minutes.setAttribute("id", `d_minutes_${id}`)
  data.appendChild(d_minutes)

  let d_seconds = document.createElement("td")
  d_seconds.setAttribute("id", `d_seconds_${id}`)
  data.appendChild(d_seconds)

  table.appendChild(heading)
  table.appendChild(data)

  mainDiv.appendChild(table)

  return mainDiv
}

/*
  alters the input section of the HTML to either have the button add or
  remove a timer and hides or shows the input box
*/
function updateAddSystem() {
  let button = document.getElementById("add")
  let input = document.getElementById("date_input")

  if(count == maxTimers) {
    input.style.display = "none"
    button.innerHTML = "timers maxed out"
    button.setAttribute("onclick", `alert("cannot add any more timers")`)
  }
  else if(count < maxTimers) {
    input.style.display = "inline"
    button.innerHTML = "add a timer"
    button.setAttribute("onclick", "addTimer()")
  }
  else {
    alert("got too many timers, something went wrong")
  }
}

/*
  begins the countdown
  To ensure all timers tick down at the same time there is only 1 timer
  it is represented by the global countdown variable, the variable allows it
   to be ended when there are no timers left
*/
function startCountdown() {
  countdown = setInterval(function(){remove1Second()}, 1000)
}
/*
  ends the countdown by clearing the value given from
  setInterval - to be called when there are no timers left
*/
function endCountdown() {
  clearInterval(countdown)
}

/*
  takes the display date and converts it to a form that
  can be sent to the server for ues as save data

  takes date in form "dayOfWeek dd/mon/yyyy"
  converts to "dd/mm/yyyy"
*/
function convertDisplayToSave(date) {
  let parts = date.split(" ") //split the date by ' ' only need one part
  let toProcess = parts[1] //only need the second section
  parts = toProcess.split("/")
  toProcess = parts[1].toLowerCase() // the month needs to be converted from a word to a number

  switch(toProcess) { // coverts the month as a word into a numeric value
    case "jan":
      toProcess = "01" // months start from 0 but the subtraction is done elsewhere
      break;
    case "feb":
      toProcess = "02"
      break;
    case "mar":
      toProcess = "03"
      break;
    case "apr":
      toProcess = "04"
      break;
    case "may":
      toProcess = "05"
      break;
    case "jun":
      toProcess = "06"
      break;
    case "jul":
      toProcess = "07"
      break;
    case "aug":
      toProcess = "08"
      break;
    case "sep":
      toProcess = "09"
      break;
    case "oct":
      toProcess = "10"
      break;
    case "nov":
      toProcess = "11"
      break;
    case "dec":
      toProcess = "12"
      break;
  }

  let retVal = `${parts[0]}/${toProcess}/${parts[2]}`
  return retVal

}

/*
  generate the timer object and adds it to the array of waiting timers (waitingTimers)
  this array is processed at the end of every second, removing the timers
  and adding them to the DOM and the array of active timers (timers)
*/
function addTimer(dateString) {
  let date

  if(dateString == null) {
    let input = document.getElementById("date_input")
    date = input.value
    input.value = ""
  }
  else date = dateString

  if(date == "") {
    alert("please enter a date first")
    return // no updates if empty date
  }

  let countdownTo = findCountdownTo(date) // generates the full date String, not for display used for processing

  let dateParts = String(countdownTo).split(" ")
  let displayDate = `${dateParts[0]} ${dateParts[2]}/${dateParts[1]}/${dateParts[3]}` //takes the more usefull parts of the full date, for display

  let saveDate = convertDisplayToSave(displayDate)

  let timeTo = countdownTo - new Date()

  if(timeTo < 0) { // date is in the past
    alert("This date is in the past")
    return
  }

  let id = nextID++ // assigns the id and increments the value so the next timer gets the correct id
  count++ // increases the count for the current number of timers

  let timerHtml = generateTimerHtml(displayDate, id, saveDate)
  let timer = {"id":id, "html": timerHtml, "till":countdownTo, "saveDate":saveDate}
  waitingTimers.push(timer)

  if(saveDataLoaded) updateAddSystem()

  if(count == 1){ //if the first timer has been added begin the countdown function
    startCountdown()
  }
}

function removeTimer(id) {
  let timer = document.getElementById(`timer_${id}`)
  let type = "in_prog"

  if(timer == null) {
    timer = document.getElementById(`timer_fin_${id}`)
    type = "fin"
  }

  let timerSection = document.getElementById("timers")

  timerSection.removeChild(timer)
  count --

/*
  removes a timer if it is part of the timers and in progress
  if the timer is DONE then it has already been removed from timers[] by this point
  since otherwise there will be an issue with trying to decrease a timer with no time
*/
  if(type == "in_prog") {
    removeFromTimers(id)
  }

  if(count == 0) {
    endCountdown(countdown)
  }
  updateAddSystem()
}

/*
  Creates and returns the HTML for a completed timer
*/
function createFinTimer(id) {                           // NEEDS WORK
  let mainDiv = document.createElement("div")
  mainDiv.setAttribute("class", "timer_fin")
  mainDiv.setAttribute("id", `timer_fin_${id}`)

  let i_div = document.createElement("div")

  let text = document.createElement("p")
  text.innerHTML = "DONE"

  i_div.appendChild(text)

// creates the remove button
  let b_rem = document.createElement("button")
  b_rem.innerHTML = "remove"
  b_rem.setAttribute("onclick", `removeTimer(${id})`)
  i_div.appendChild(b_rem)

  mainDiv.appendChild(i_div)

  return mainDiv
}

/*
  replaces the completed timer with the related HTML
*/
function setTimerToDone(id) {
  let timer
  let html = createFinTimer(id)
  let date

  timer = document.getElementById(`timer_${id}`)
  if(timer == null) timer = document.getElementById(`timer_${id}_saved`)
  timer.replaceWith(html)
  for(i = 0; i < timers.length; i++){
    let current = timers[i]
    if (current.id == id) {
      date = current.saveDate
    }
  }
  sendUnsaveRequest(id, date)
  removeFromTimers(id)
}

/*
  finds the time till the desired date and adds it to the timer HTML
*/
function addDateInfo(html, endDate, startDate) {
  let timeTo = endDate - startDate

  let seconds = 0
  let minutes = 0
  let hours = 0
  let days = 0
  let years = 0
  let valueBundle

  seconds = Math.round(timeTo / 1000)

  let secs_in_min = 60
  let secs_in_hour = 60 * 60
  let secs_in_day = 60 * 60 * 24
  let secs_in_year = 60 * 60 * 24 * 365
  let resObj

  resObj = timeConversion(seconds, secs_in_year)
  seconds = resObj.sec
  years = resObj.res

  resObj = timeConversion(seconds, secs_in_day)
  seconds = resObj.sec
  days = resObj.res

  resObj = timeConversion(seconds, secs_in_hour)
  seconds = resObj.sec
  hours = resObj.res

  resObj = timeConversion(seconds, secs_in_min)
  seconds = resObj.sec
  minutes = resObj.res

  let timer = html.getElementsByClassName("time_values")[0] //there is only one of these sections per timer
  let sections = timer.children

  sections[0].innerHTML = years
  sections[1].innerHTML = days
  sections[2].innerHTML = hours
  sections[3].innerHTML = minutes
  sections[4].innerHTML = seconds

  return html
}

/*
  inserts the timers in the waitingTimers array to the HTML
  this allows all timers to tick down as accuratley as possible
  since they don't get added midway through the tickdown method
*/
function insertTimers() {
  let timerSection = document.getElementById("timers")
  for(i = waitingTimers.length - 1; i >= 0; i--) {

    let html = waitingTimers[i].html  // takes the html out to append it to the timers section
    let endDate = waitingTimers[i].till
    let startDate = new Date()

    html = addDateInfo(html, endDate, startDate)

    timers.push(waitingTimers[i]) // adds the element to the array for current timers
    waitingTimers.splice(i, 1)  // removes the element from the waiting array

    timerSection.appendChild(html)
  }
}

function addDropdownDateToInput() {
  let dropDown = document.getElementById("dropdown")
  let date = dropdown.value
  let current = new Date()
  let year = String(current.getFullYear())
  let dateArray = date.split('/')
  let desDay = dateArray[0]
  let desMon = dateArray[1]

  let desiredDay = new Date(year, desMon - 1, desDay)  // need to -1 for the check variable since months start at 0, for dsiplay use 1-12

  if(desiredDay < current) {    // if the date wanted is in the past go one year forwards
    year = String(current.getFullYear() + 1)
  }
  let inputBox = document.getElementById("date_input")
  inputBox.value = `${desDay}/${desMon}/${year}`
  dropDown.value = ""
}

/*
  Iterates through all current timers and removes a second
  then adds all the pending timers - see NB - to the html after the reduction is done

  NB - when a timer is added it waits in an array to be added after the timers are all reduced
       so that timers are not added midway through the process of reducing timers
*/
function remove1Second() {
  for(i = 0; i < timers.length; i++) {
    let timer = timers[i]
    let id = timer.id
    let seconds = document.getElementById(`d_seconds_${id}`)

    if(seconds.innerHTML != 0) {
      seconds.innerHTML-- //seconds go down by 1
    }
    else {  // no seconds left
      var minutes = document.getElementById(`d_minutes_${id}`)
      if(minutes.innerHTML != 0) {
        minutes.innerHTML--
        seconds.innerHTML = 59  // minutes go down by 1 seconds become the 59 seconds left of the original minute
      }
      else{ // no minutes left
        var hours = document.getElementById(`d_hours_${id}`)
        if(hours.innerHTML != 0){
          hours.innerHTML--
          minutes.innerHTML = 59
          seconds.innerHTML = 59
        }
        else { // no hours left
          var days = document.getElementById(`d_days_${id}`)
          if(days.innerHTML != 0) {
            days.innerHTML--
            hours.innerHTML = 23
            minutes.innerHTML = 59
            secconds.innerHTML = 59
          }
          else { // no days left
            var years = document.getElementById(`d_years_${id}`)
            if(years.innerHTML != 0){
              years.innerHTML--
              days.innerHTML = 363
              hours.innerHTML = 23
              minutes.innerHTML = 59
              seconds.innerHTML = 59
            }
            else{
              setTimerToDone(id)  // needs work
            }
          }
        }
      }
    }
  }
  insertTimers()
}
