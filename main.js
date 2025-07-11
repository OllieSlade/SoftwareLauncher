window.onload = function(){
    if (document.getElementById("home") === null) return 
    document.getElementById("home").classList.add("selected")
    document.getElementById("favourites").classList.remove("selected")
    // this sets up and loads in all the programs, only ever run once
    home()
}

window.api.receive("getApps", (files, override) => {
    getApps(files, override)
})

function getApps(files, override) {
    if (document.getElementById("programHolder").innerHTML != "" && !override) return
    if (!override) {
        document.getElementById("programHolder").innerHTML = ""
        document.getElementById("programTableBody").innerHTML = ""
    }
    let style = true
    files.forEach(file => {  
        if (override) {
            try {
                document.querySelector(`tr [data-prgFile="${file["file"]}"`).parentElement.remove()
                document.querySelector(`div [data-prgFile="${file["file"]}"`).remove()
            } catch (TypeError) {null}
        }
        document.getElementById("programHolder").innerHTML +=   `<div data-prgFile="${file["file"]}" onclick="runProgram(uri='${file["file"]}')" class="program hover" title="${file["desc"]}">
                                                                <img onerror="this.onerror=null;this.src='./static/noProgram.png';" alt="${file["desc"]}" src="${file["iconPath"]}">
                                                                <span>${file["iconName"]}</span></div>` 
        document.getElementById("programTableBody").innerHTML += `
                                                                <tr onclick="selected()" ondblclick="runProgram(uri='${file["file"]}')" class="programRow" data-prgFile="${file["file"]}">
                                                                    <td data-prgFile="${file["file"]}"><img onerror="this.onerror=null;this.src='./static/noProgram.png';" src="${file["iconPath"]}" class="smallIcon"><p>${file["file"]}</p></td>
                                                                    <td>${file["desc"]}</td>
                                                                    <td>${file["tags"].join(", ")}</td>
                                                                </tr>`
        style = file["largeIcons"]
    })
    document.querySelector(".loadingHere").classList.add("hidden")
    document.getElementById("programCount").innerText = files.length
    if (files.length == 0) document.querySelector(".nothingHere").classList.remove("hidden")
    else document.querySelector(".nothingHere").classList.add("hidden")
    styleToggle(style)
}

function favourites(reload) {
    // prevents event emitter spam, if you are already on this page the call to go to said page will be ignored. If there is something in the search box it will still be called
    if ( document.getElementById("searchSub").screen === "favourites" && document.getElementById("search").value == "") return

    // clearing the search box, setting current screen, calling the search system, higlighting an icon
    document.getElementById("search").value = ""
    document.getElementById("searchSub").screen = "favourites"
    if (reload != false ) searchFunction({search:"none", extra:"favourites"})
    document.getElementById("favourites").classList.add("selected")
    document.getElementById("home").classList.remove("selected")
}
// reload attribute here is passed as false if the page has already been reloaded and does not need to be reloaded again
function home(reload) {
    // prevents event emitter spam, if you are already on this page the call to go to said page will be ignored. If there is something in the search box it will still be called
    if ( document.getElementById("searchSub").screen === "home" && document.getElementById("search").value == "") return

    // clearing the search box, setting current screen, calling the search system, higlighting an icon
    document.getElementById("search").value = ""
    document.getElementById("searchSub").screen = "home"
    if (reload != false ) searchFunction({search:"none", extra:"none"})
    document.getElementById("home").classList.add("selected")
    document.getElementById("favourites").classList.remove("selected")
}

function searchCall(override) {
    // if there was something specified when this was called then that has priority
    let searchTerm = override != undefined ? override : document.getElementById("search").value
    // keeping stuff uniform
    if (searchTerm == "") searchTerm = "none"
    // extra is just a limiter, for example only searching within favourites
    searchTerm = {search:searchTerm, extra:document.getElementById("searchSub").screen}
    searchFunction(searchTerm)
}

function searchFunction(searchTerm) {
    window.api.send("getApps", searchTerm)
}

window.api.receive("getApps", (files) => {
    // getting all programs that were generated on startup
    let programs = Array.from(document.querySelectorAll(".program"))
    let programsLine = Array.from(document.querySelectorAll(".programRow"))
    if (files.length == 0) document.querySelector(".nothingHere").classList.remove("hidden")

    programs.forEach(program => {
        if (files.some(v => v["file"] == program.getAttribute("data-prgFile"))) {
            program.classList.remove("hidden")
        } else {
            program.classList.add("hidden")
        }
    })
    programsLine.forEach(program => {
        if (files.some(v => v["file"] == program.getAttribute("data-prgFile"))) {
            program.classList.remove("hidden")
        } else {
            program.classList.add("hidden")
        }
    })
    if (files.length != 0) document.querySelector(".nothingHere").classList.add("hidden")
    document.getElementById("programCount").innerText = files.length
})

function runProgram(uri) {
    window.api.send("loadApp", uri)
}

window.api.receive("fromMain", (data) => {
    console.log(`Received ${data} from a process`);
    if (data == "reloadApps") {
        // extra:extra means that if it reloads on favs it will stay on favs
        extra = document.getElementById("searchSub").screen ?? ""
        search = document.getElementById("search").value ?? "none"
        searchFunction({search:search, extra:extra})
    } else if (data === "baseURI") {
        settingsWindow()
    } else if (data === "fullReload") {
        // update icons means the icon paths will all up updated in programData
        extra = document.getElementById("searchSub").screen ?? ""
        search = document.getElementById("search").value ?? "none"
        // if (extra == "home") home(false)
        // else if (extra == "favourites") favourites(false)
        window.api.send("getApps", {search:search, extra:extra, override:true, updateIcons:true})
    }
    console.log(`Processed ${data}`);
});

function openFileExplorer(box) {
    if (box != undefined) {
        window.api.send("openExplorer", {bool:true, box:box})
    } else {
        window.api.send("openExplorer", false)
    }
}

function openSettingsPath() {
    window.api.send("openExplorer", {bool:false, box:"settingsPath"})
}

window.api.receive("openExplorer", (result) => {
    if (result["success"] == false) return 
    if (result["box"] === "programsPath") {
        document.getElementById("programsPath").value = result["results"]
    } else if (result["box"] === "iconsPath") {
        document.getElementById("iconsPath").value = result["results"]
    }
})

window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    let elem = document.elementFromPoint(e.pageX, e.pageY)
    let file = elem.getAttribute("data-prgFile") ?? elem.parentElement.getAttribute("data-prgFile")
    window.api.send('show-context-menu', file)
})

function infoWindow() {
    window.api.send("newWindow", { page:"info.html" })
}

function settingsWindow() {
    window.api.send("newWindow", { page:"settings.html" })
}

function appInfoWindow() {
    window.api.send("newWindow", { page:"appInfo.html" })
}

function styleToggle(largeIcons) {
    if (largeIcons) {
        document.getElementById("picIcon").classList.add("hidden")
        document.getElementById("listIcon").classList.remove("hidden")
        document.getElementById("programTable").classList.add("hidden")
        document.getElementById("programHolder").classList.remove("hidden")
    } else if (largeIcons === undefined) {
        document.getElementById("picIcon").classList.toggle("hidden")
        document.getElementById("listIcon").classList.toggle("hidden")
        document.getElementById("programTable").classList.toggle("hidden")
        document.getElementById("programHolder").classList.toggle("hidden")
    } else {
        document.getElementById("picIcon").classList.remove("hidden")
        document.getElementById("listIcon").classList.add("hidden")
        document.getElementById("programTable").classList.remove("hidden")
        document.getElementById("programHolder").classList.add("hidden")
    }
    let style = document.getElementById("programHolder").classList.contains("hidden") ? false : true
    window.api.send("styleToggle", style)
}

function selected() {
    document.querySelectorAll(".selectedLine").forEach((elem) => {
        elem.classList.remove("selectedLine")
    })
    window.event.target.parentElement.classList.toggle("selectedLine")
}

function restart() {
    window.api.send("restart")
}

// info.html

function givemeicons(extra) {
    if (extra == "settings") {
        let locat = document.getElementById("programsPath").value
        window.api.send('giveMeIcons', locat)
        document.getElementById("iconsPath").value = locat + "\\" + "Icons"
    } else {
        window.api.send('giveMeIcons')
    }
}

function checkForUpdates() {
    window.api.send('updateChecker')
}


// settings.html

function closeRemote(args) {
    console.log("bongles");
    if (args != "delete") {
        let iconURI = document.getElementById("iconsPath").value
        let appsURI = document.getElementById("programsPath").value
        args = {icons:iconURI, apps:appsURI, action:args}
    } else {
        args = {icons:"", apps:"", action:"delete", override:true}
    }

    window.api.send("closeRemote", args)
}

function makeJson() {
    let iconURI = document.getElementById("iconsPath").value
    let appsURI = document.getElementById("programsPath").value
    args = {icons:iconURI, apps:appsURI, override:"full"}
    window.api.send("makeJson", args)
}


// appInfo.html

function editAppInfo() {
    let fields = document.getElementById("appInfoFields")
    let openBtn = document.getElementById("openBtn")
    let editBtn = document.getElementById("editBtn")
    let cancelBtn = document.getElementById("cancelBtn")
    let path = document.getElementById("appName").value

    fields.disabled = false
    openBtn.innerHTML = "Cancel"
    editBtn.innerHTML = "Save"
    cancelBtn.innerHTML = "Save and Close"

    openBtn.onclick = function() {
        fields.disabled = true
        openBtn.innerHTML = "Open App"
        editBtn.innerHTML = "Edit"
        cancelBtn.innerHTML = "Close"

        openBtn.onclick = function(){runProgram(path)}
        editBtn.onclick = function(){editAppInfo(path)}
        cancelBtn.onclick = function(){closeRemote('delete')}
    }
    editBtn.onclick = function() {closeRemote2(path, "saveInfo")}
    cancelBtn.onclick = function() {closeRemote2(path, "saveInfoExit")}
}

function closeRemote2(path, action) {
    if (action != "delete") {
        let shortDesc = document.getElementById("shortDesc").value
        let longDesc = document.getElementById("longDesc").value
        let fileName = document.getElementById("appName").value
        let tags = document.getElementById("tags").value
        let displayName = document.getElementById("DappName").value
        args = {shortDesc, longDesc, oldFileName:path, fileName, tags, displayName, action}
    } else {
        args = {action:""}
    }

    window.api.send("closeRemote", args) 
}

window.api.receive("closeRemote", (result) => {
    document.getElementById("editBtn").onclick = function() {closeRemote2(result, "saveInfo")}
    document.getElementById("cancelBtn").onclick = function() {closeRemote2(result, "saveInfoExit")}
})