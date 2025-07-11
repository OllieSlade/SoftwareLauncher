require('v8-compile-cache');
const { app, BrowserWindow } = require('electron')
const { setupTitlebar, attachTitlebarToWindow } = require("custom-electron-titlebar/main")
const path = require("path")

app.whenReady().then(createWindow)
setupTitlebar();

async function createWindow () {
  win = new BrowserWindow({
    width: 900,
    minWidth: 616,
    height: 600,
    minHeight: 270,
    frame: false,
    backgroundColor: "#faf9f8",
    show: false,
    webPreferences: {
      contextIsolation: true,
      enableRemoteModule: true, // i dont want this enabled but the special title bar needs it
      preload: path.join(__dirname, "preload.js")
    }
  })
  // win.webContents.openDevTools()
  win.setIcon(path.join(__dirname, "static/defaultImage.ico"))
  win.loadFile(path.join(__dirname, 'templates/index.html'))
  attachTitlebarToWindow(win);
  
  // userTasksSetter()
  // win.show()
  win.show()
  
  // unassigns win, prevents errors
  win.on('closed', () => {
    win = null
  })
}



const { ipcMain, shell, Menu, dialog } = require('electron')
const fs = require("fs")

let win
let newWin
var baseURI = ""
var icons = ""
var baseAgnosticURI = ""
var largeIcons
var dataPath = path.join(__dirname, "/RepairStickSettings")

fs.access(path.join(dataPath, "settings.json"), async (err) => {
  if (err && err["code"] == "ENOENT") {
    await fs.promises.mkdir(dataPath)
      .catch(err => {
        if (err["code"] === "EEXIST") null
        else console.error(err)
      })

    let data = JSON.stringify({ favourites: [], appData: "", iconData: "", largeIcons: false }, null, 4)

    fs.writeFile(path.join(dataPath,"settings.json"), data, "utf-8", (err) => {
      if (err) throw err
      console.log("Settings Created");

    })

  } else {
    let settingsFile
    await fs.promises.readFile(path.join(dataPath, "settings.json"), "utf-8")
      .then((data) => {settingsFile = JSON.parse(data)})
      .catch((err) => {console.error(err)})

    baseURI = settingsFile["appData"]
    if (baseURI.startsWith("%CD%")) {
      baseAgnosticURI = baseURI
      baseURI = baseURI.replace("%CD%", __dirname.split(":")[0])
    }

    icons = settingsFile["iconData"]
    if (icons.startsWith("%CD%")) icons = icons.replace("%CD%", __dirname.split(":")[0])
    largeIcons = settingsFile["largeIcons"]
    
    console.log("Settings Loaded")
  }
  console.log(`Launching Software: Version ${app.getVersion()}\nUsing Electron: ${process.versions.electron}`);
})

app.on('before-quit', async (event) => {
  event.preventDefault()
  let data
  await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
    .then((lData) => {data = JSON.parse(lData)})
    .catch((err) => {console.error(err)})

  if (!data) app.exit()
  data["largeIcons"] = largeIcons
  fs.writeFile(path.join(dataPath,"settings.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
    if (err) throw err
    console.log("style updated");
    app.exit()
  })
})

ipcMain.on("loadApp", async (_event, uri) => {
  // this runs a program
  // does it by magic
  if (uri === "pdf") {
    shell.openPath(`"${path.join(__dirname, "static", "Usage and Information for the Disking Repair USB.pdf")}"`).then(result => {
      if (result != "") dialog.showErrorBox(title="", content=`Unable to open help doc. \nError Code: ${result}`)
    })
  } else {
    shell.openPath(`"${path.join(baseURI, uri)}"`).then(result => {
      if (result != "") dialog.showErrorBox(title="", content=`Unable to run that program. Please make sure its working properly and try again.\nError Code: ${result}`)
    })
  }
})

async function userTasksSetter() {
  let targetURI = (baseAgnosticURI || baseURI).toLowerCase()
  let userTasks = []
  fs.readdir(baseURI, async function(err, files) {
    if (err) return

    let data
    await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
      .then((lData) => {data = JSON.parse(lData)})
      .catch(() => {return})

    let programData
    await fs.promises.readFile(path.join(dataPath,"programData.json"), "utf-8")
      .then((lData) => {programData = JSON.parse(lData)})
      .catch((err) => {console.error(err)})

    if (programData[targetURI] == undefined) return
    getAppsGen(files, data, programData, {search:"none", extra:"favourites"}, (finalFiles) => {
      finalFiles.forEach((file) => {
        userTasks.push(
          {
            program: path.join(baseURI, file["file"]),
            iconPath: file["iconPath"],
            iconIndex: 0,
            title: file["iconName"],
            description: file["desc"]
          }
        )
      })
      app.setUserTasks(userTasks)
      console.log("User Tasks Set");
    }) 
  })
}

ipcMain.on("getApps", async (event, searchTerm) => {
  // returns a list of apps with the icon directory at index 0
  // reads specified directory
  await fs.promises.access(baseURI)
    .catch(() => {
      dialog.showErrorBox(title="", content="Invalid file path, please edit it in settings.")
      return event.reply("getApps", [], searchTerm["override"])
    })
    
  fs.readdir(baseURI, async function(err, files) {
    if(err) {
      if (err["code"] == "ENOENT") return
      else console.error(err)
    }

    let data
    let programData
    await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
      .then((lData) => {data = JSON.parse(lData)})
      .catch((err) => {console.error(err)})

    jsonator({apps:""}, searchTerm["updateIcons"], async () => {
      await fs.promises.readFile(path.join(dataPath,"programData.json"), "utf-8")
        .then((data) => {programData = JSON.parse(data)})
        .catch((err) => {console.error(err)})

      getAppsGen(files, data, programData, searchTerm, (finalFiles) => {
        event.reply("getApps", finalFiles, searchTerm["override"])
      }) 
    })
  })
})

async function getAppsGen(files, data, programData, searchTerm, theCallback) {
  let targetURI = (baseAgnosticURI || baseURI).toLowerCase()
  let finalFiles = []
  search = searchTerm["search"]
  files.forEach(file => {

    let iconName = programData[targetURI][file.split(".")[0].toLowerCase()]["displayName"]
    let iconDesc = programData[targetURI][file.split(".")[0].toLowerCase()]["shortDesc"]
    let tags = programData[targetURI][file.split(".")[0].toLowerCase()]["tags"]
    let searchable = file + iconName + iconDesc + tags.join(" ")

    if ((file.endsWith(".cmd") || file.endsWith(".bat") || file.endsWith(".exe") || file.endsWith(".lnk")) && (searchable.toLowerCase().includes(search.toLowerCase()) || search === "none") && 
    (searchTerm["extra"] != "favourites" || data["favourites"].includes(file.toLowerCase()))) {
      let iconPath = programData[targetURI][file.split(".")[0].toLowerCase()]["iconPath"]
      if (iconPath === "") {
        iconPath = path.join(__dirname, "static/noProgram.png")
      } else {
        iconPath = path.join(icons, iconPath)
      }
      
      finalFiles.push({file:file, desc:iconDesc, iconPath, tags:tags, iconName, largeIcons})
    }
  })
  theCallback(finalFiles)
}

ipcMain.on('show-context-menu', async (event, cmdFile) => {
  // Gets called by the renderer, this sets up the context menu and shows it
  if (cmdFile === null) return // returns if what was right clicked is illegal

  // always adds view more details
  var template = [
    {
      label: 'View More Details',
      click: () => { contextCommand('details', cmdFile) }
    },
    {
      label: 'Edit Details',
      click: () => { contextCommand('editDetails', cmdFile) }
    },
    { type: 'separator' }
  ]

  let data
  await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
    .then((lData) => {data = JSON.parse(lData)})
    .catch((err) => {console.error(err)})

  // works out if it is in favourites or not, and adds a specific option depending on that
  if (data["favourites"].includes(cmdFile.toLowerCase())) {
    template.push(
      {
        label: 'Remove from Favourites',
        click: () => { contextCommand('remove-favourites', cmdFile) }
      })
  } else {
    template.push(
      {
        label: 'Add to Favourites',
        click: () => { contextCommand('add-favourites', cmdFile) }
      })
  }

  // show menu
  const menu = Menu.buildFromTemplate(template)
  menu.popup(BrowserWindow.fromWebContents(event.sender))
})

async function contextCommand(cmd, program) {
  // reacts when someone clicks an option on the context menu
  // external package, callback async function to return data from the settings doc
  let data
  await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
    .then((lData) => {data = JSON.parse(lData)})
    .catch((err) => {console.error(err)})

    // checks to see whether the payload is to be added or removed
    if (cmd == "add-favourites") {
      data["favourites"].push(program.toLowerCase())
      win.webContents.send("fromMain", "reloadApps")
    } else if (cmd == "remove-favourites") {
      var filtered = data["favourites"].filter(function(value, _index, _arr){ 
        return value != program.toLowerCase();
      })
      data["favourites"] = filtered
      win.webContents.send("fromMain", "reloadApps")
    } else if (cmd === "details") {
      newWindowLauncher({page:"appInfo.html", app:program.toLowerCase()})
    } else if (cmd === "editDetails") {
      newWindowLauncher({page:"appInfo.html", app:program.toLowerCase(), editMode:true})
    }
    
    // updates the settings doc
    fs.writeFile(path.join(dataPath,"settings.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
      if (err) throw err
    })
}

ipcMain.on("openExplorer", async (event, forFile) => {
  // opens explorer to the path that contains all the programs
  if (forFile["bool"]) {
    let locat = baseURI == "" ? __dirname : baseURI
    // shows the options to select a directory
    dialog.showOpenDialog(win, {
      title: "Pick a Path",
      defaultPath: locat,
      properties: ["openDirectory"]
    }).then(result => {
      if (result.canceled) {
          event.reply("openExplorer", {success: false, box:forFile["box"], results:null}) 
      } else {
          event.reply("openExplorer", {success: true, box:forFile["box"], results:result.filePaths[0]}) 
      }
    })
  } else {
    console.log(dataPath)
    if (forFile["box"] == "settingsPath") return shell.openPath(dataPath)
    shell.openPath(baseURI) 
  }
})

ipcMain.on("newWindow", async (_event, args) => {
  newWindowLauncher(args)
})

async function newWindowLauncher(args) {
  // generates a new window
  newWin = new BrowserWindow({
    width: 600,
    height: 600,
    backgroundColor: "#fffff",
    show: false,
    parent: win,
    modal: true,
    resizable: false,
    maximizable: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preloadExternal.js")
    }
  })
  newWin.removeMenu()
  // newWin.webContents.openDevTools()
  newWin.setIcon(path.join(__dirname, "static/defaultImage.ico"))
  newWin.loadFile(path.join(__dirname, `templates/${args["page"]}`))

  // SHOULD avoid pop in
  newWin.once("ready-to-show", () => {
    newWin.show()
    if (args["page"] === "appInfo.html") {
      appDataObtainer(args["app"].toLowerCase(), (data)=>{
        data["editMode"] = args["editMode"] != undefined && args["editMode"] ? true : false
        newWin.webContents.send("dataLoader", data)
      })
    }
  })

  // unassigns win, prevents errors
  newWin.on('closed', () => {
    newWin = null
  })
}

async function appDataObtainer(appName, theCallback) {
  let targetURI = (baseAgnosticURI || baseURI).toLowerCase()
  fs.readFile(path.join(dataPath,"programData.json"), "utf-8", (err, data) => {
    if (err) console.error(err)
    data = JSON.parse(data)
    try {
      theCallback(data[targetURI][appName.split(".")[0]]) 
    }
    catch (err){console.error(err);}
  })

}

ipcMain.on("information", async (event) => {
  event.reply("information", {electron:process.versions.electron, app:app.getVersion(), appURI:baseURI, iconURI:icons})
})

ipcMain.on("giveMeIcons", async (_event, args) => {
  const iconExtractor = require("icon-extractor")
  let locat = args || (baseAgnosticURI || baseURI)
  let fullPath = path.join(locat, "Icons")
  await fs.promises.access(baseURI)
    .catch(() => {
      try {
        if (!fs.existsSync(locat)) return dialog.showErrorBox(title="", content="Invalid applications path. Please change it before continuing.")
        else fs.mkdirSync(fullPath)
      }
      catch (err) {
        if (err["code"] === "EPERM") return dialog.showErrorBox(title="", content="Not enough permissions to create an icon library here. Relauch in admin mode.")
        else if (err["code"] === "ENOENT") return dialog.showErrorBox(title="", content="Invalid icon path. Please correct it or make sure the folder exists and try again.")
        else return dialog.showErrorBox(title="An Unknown Error Occured!", content=`${err}`)
      }
    })

  await fs.promises.mkdir(fullPath)
    .catch(err => {
      if (err["code"] === "EEXIST") null
      else console.error(err)
    })

  iconExtractor.emitter.on('icon', async function(data) {
    if (data.Path == "") return // Icon specified in the renderer 
    
    // sets a special "folder" icon for suspected folders
    else if (!data.Path.includes(".")) return fs.copyFile(path.join(__dirname, "static", "folder.png"), path.join(locat, "Icons", data.Context + ".ico"), (_err) => {}) 
    var icon = data.Base64ImageData;
    // writes the base64 data to a file
    fs.writeFile(path.join(locat, "Icons", data.Context + ".ico"), icon, 'base64', (_err) => {
      return
    })
  })

  jsonator({apps:locat}, false, async () => {
    let files
    let iconFiles
    let data
    await fs.promises.readdir(locat)
      .then((lData) => {files = lData})
      .catch((err) => {console.error(err)})
    
    await fs.promises.readdir(fullPath)
      .then((lData) => {iconFiles = lData})
      .catch((err) => {console.error(err)})
      
    await fs.promises.readFile(path.join(dataPath,"programData.json"), "utf-8")
      .then((lData) => {data = JSON.parse(lData)})
      .catch((err) => {console.error(err)})

    if (files == []) {
      console.log("donK");
      return
    }
    files.forEach(file => {
      if (file.endsWith(".cmd") || file.endsWith(".bat") || file.endsWith(".exe") || file.endsWith(".lnk")) {
        let iconName = file.split(".")[0]
        iconName = iconName.toLowerCase()
        if (iconFiles.includes(iconName + ".ico")) return
        let programFile = path.join(locat, file)
        // is the program a shortcut?
        if (file.endsWith(".lnk")) {
          try {
            // attempts to work out icon location, or the location of the exe
            let iconInfo = shell.readShortcutLink(programFile)
            if (!iconInfo["icon"].endsWith("exe") && iconInfo["icon"] != "") {
              // if there was an icon file found in the program files copy it over
              return fs.copyFile(iconInfo["icon"], path.join(fullPath, iconName + ".ico"), (err) => {
                console.error(err)
                data[locat.toLowerCase()][file.split(".")[0].toLowerCase()]["iconPath"] = iconName + ".ico"

                fs.writeFile(path.join(dataPath,"settings.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
                  if (err) throw err
                })
              })
            }
            else programFile = iconInfo["target"]
          } catch(err) {}
        }
        data[locat.toLowerCase()][file.split(".")[0].toLowerCase()]["iconPath"] = iconName + ".ico"
        fs.writeFile(path.join(dataPath,"programData.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
          if (err) throw err
        })
        iconExtractor.getIcon(iconName, programFile);
      }
    })
    shell.openPath(fullPath) 
  })
})

ipcMain.on("closeRemote", async (_event, args) => {
  // this is for saving the data in the settings and appdata menus
  let targetURI = (baseAgnosticURI || baseURI).toLowerCase()
  if (args["action"] === "delete") {
    newWin.close()
  } else if (args["action"] === "save") { // editing the baseurl and icon url from the settings menu
    let data
    await fs.promises.readFile(path.join(dataPath,"settings.json"), "utf-8")
      .then((lData) => {data = JSON.parse(lData)})
      .catch((err) => {console.error(err)})

    // checks the paths submitted are real paths
    if (!fs.existsSync(args["apps"])) return dialog.showErrorBox(title="", content="Invalid applications path. Please change it before continuing.")
    let driveLetter = __dirname.split(":")[0]

    if (fs.existsSync(args["icons"])) {
      if (args["icons"].startsWith(driveLetter)) {
        data["iconData"] = args["icons"].replace(driveLetter, "%CD%")
        icons = args["icons"]
      } else {
        data["iconData"] = args["icons"]
        icons = args["icons"]
      }
    }
    if (args["apps"].startsWith(driveLetter)) {
      data["appData"] = args["apps"].replace(driveLetter, "%CD%")
      baseURI = args["apps"]
      baseAgnosticURI = args["apps"].replace(driveLetter, "%CD%")
    } else {
      data["appData"] = args["apps"]
      baseURI = args["apps"]
    }
    
    fs.writeFile(path.join(dataPath,"settings.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
      if (err) throw err
      try {newWin.close()}
      catch {null}
      console.log("Settings Updated")
      win.webContents.send("fromMain", "fullReload")
    })

  } else if (args["action"] === "saveInfo" || args["action"] === "saveInfoExit") { // Saving the edited info from the more info section
    let currentPath
    let data
    await fs.promises.readFile(path.join(dataPath,"programData.json"), "utf-8")
      .then((lData) => {data = JSON.parse(lData)})
      .catch((err) => {console.error(err)})

    if (/[?"\\|*/<>:]/g.test(args["fileName"])) return dialog.showErrorBox(title="", content="Invalid Character in File Name (Cannot contain ? \" \\ | * / < > :)")
    await fs.promises.rename(path.join(baseURI, args["oldFileName"]), path.join(baseURI, args["fileName"]))
      .catch((err) => {
        currentPath = args["oldFileName"]
        switch (err["code"]) {
          case "EPERM":
            return dialog.showErrorBox(title="", content="Unable to rename local files, please relaunch in admin mode. Skipping filename change.")
          default:
            return dialog.showErrorBox(title="An Unknown Error Occured! (May be an invalid File Name)", content=`${err}`)
        }
      })

    currentPath = args["fileName"]
    let iconPath = data[targetURI][args["oldFileName"].split(".")[0].toLowerCase()]["iconPath"]
    // deletes the old entry and writes a completely new one incase the filename
    delete data[targetURI][args["oldFileName"].split(".")[0].toLowerCase()]
    data[targetURI][args["fileName"].split(".")[0].toLowerCase()] = {fileName: args["fileName"], displayName:args["displayName"], 
        shortDesc:args["shortDesc"], longDesc:args["longDesc"], iconPath}

    let tags = args["tags"].split(",")
    tags.forEach(async function(part, index, theArray) {
      // strips the whitespace off of tags
      theArray[index] = part.trim()
    })
    data[targetURI][args["fileName"].split(".")[0].toLowerCase()]["tags"] = tags

    fs.writeFile(path.join(dataPath,"programData.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
      if (err) throw err
      // exits if the save and exit button was clicked
      if (args["action"] === "saveInfoExit"){
        newWin.close()
        win.webContents.send("fromMain", "fullReload")
      } else {
        // prints a dialog box if it wasnt exited
        dialog.showMessageBox(newWin, {
          message: "Successfully updated program information!",
          type: "info",
          title: "Success!"
        })
        newWin.webContents.send("closeRemote", currentPath)
      }
      console.log("Program Info Updated")
    })
  }
})

ipcMain.on("makeJson", async (_event, args) => {
  if (!fs.existsSync(args["apps"])) return dialog.showErrorBox(title="", content="Invalid applications path. Please change it before continuing.")
  jsonator(args, false, (success) => {
    if (success) {
      dialog.showMessageBox(newWin, {
        message: "Successfully generated application information!",
        type: "info",
        title: "Success!"
      })
    } else {
      dialog.showErrorBox("", "Failed to generate application information file!")
    }
  })
})

async function jsonator(args, iconReplace, theCallback) {
  let targetURI = (args["apps"] || (baseAgnosticURI || baseURI)).toLowerCase()
  let apps = args["apps"] || baseURI
  fs.access(path.join(dataPath, "programData.json"), async (err) => {
    let success
    // checks if settings exists, if it does does nothing, if it doesn't creates it
    if (err && err["code"] == "ENOENT") {
      let programData = {}
      programData[targetURI] = {}
      fs.readdir(apps, async function(err, files) {
        if (err) return
        files.forEach(file => {
          // gets the shortDesc between file brackets
          let iconDesc = /[()]/.test(file) ? file.match(/\(([^)]+)\)/)[1] : ""

          let iconPath
          let iconName = file.includes(" ") ? file.substr(0, file.indexOf(" ")) : file.split(".")[0]
          if (fs.existsSync(path.join(icons, iconName.toLowerCase() + ".ico"))){
            iconPath = iconName.toLowerCase() + ".ico"
          } else if (fs.existsSync(path.join(icons, file.split(".")[0].toLowerCase() + ".ico"))){
            iconPath = file.split(".")[0].toLowerCase() + ".ico"
          } else {
            iconPath = "" // path.join(__dirname, "static/noProgram.png")
          }

          programData[targetURI][file.split(".")[0].toLowerCase()] = {
            fileName:file,
            displayName:iconName,
            shortDesc:iconDesc,
            longDesc:iconDesc,
            iconPath,
            tags:[]
          }
        })
        fs.writeFile(path.join(dataPath,"programData.json"), JSON.stringify(programData, null, 4), "utf-8", (err) => {
          if (err) throw err
          success = true
          console.log("Program Data Created");
          theCallback(success)
        })
      })
    } else {
      // if the settings file already exists append a new path to it and write in data
      let data
      await fs.promises.readFile(path.join(dataPath,"programData.json"), "utf-8")
        .then((lData) => {data = JSON.parse(lData)})
        .catch((err) => {console.error(err)})

      // prevents overwriting unless asked for
      if (data[targetURI] == undefined || args["override"] == "full") {
        data[targetURI] = {}
      }
      fs.readdir(apps, async function(_err, files) {
        files.forEach(file => {
          // if the app name is already in the json file, skip. Unless an override is called
          if (data[targetURI][file.split(".")[0].toLowerCase()] != undefined && (iconReplace != true)) return
          // gets the shortDesc between file brackets
          let iconDesc = file.includes("(") && file.includes(")") ? file.match(/\(([^)]+)\)/)[1] : "No Description"
          let iconPath
          let iconName = file.includes(" ") ? file.substr(0, file.indexOf(" ")) : file.split(".")[0]
          // if there wasnt an app entry for that file already, create it
          if (data[targetURI][file.split(".")[0].toLowerCase()] == undefined) {
            data[targetURI][file.split(".")[0].toLowerCase()] = {
              fileName:file,
              displayName:iconName,
              shortDesc:iconDesc,
              longDesc:iconDesc,
              iconPath:"",
              tags:[]
            }
          }
          // if there isnt an entry for the icon location already or override has been triggered create it/replace it 
          if (data[targetURI][file.split(".")[0].toLowerCase()]["iconPath"] == undefined || iconReplace === true) {
            if (fs.existsSync(path.join(icons, iconName.toLowerCase() + ".ico"))){
              iconPath = iconName.toLowerCase() + ".ico"
            } else if (fs.existsSync(path.join(icons, file.split(".")[0].toLowerCase() + ".ico"))){
              iconPath = file.split(".")[0].toLowerCase() + ".ico"
            } else {
              iconPath = "" // path.join(__dirname, "static/noProgram.png")
            }
            data[targetURI][file.split(".")[0].toLowerCase()]["iconPath"] = iconPath
          }
        })
        fs.writeFile(path.join(dataPath,"programData.json"), JSON.stringify(data, null, 4), "utf-8", (err) => {
          if (err) throw err
          success = true
          theCallback(success)
        })       
      })
    }
  })
}

ipcMain.on("updateChecker", async (_event) => {
  dialog.showMessageBox(newWin, {
    message: "Check yourself. By asking Ollie. (There probably aren't any)",
    type: "info",
    title: "Stop being lazy"
  })
})                                  

ipcMain.on("styleToggle", async (_event, value) => {
  largeIcons = value
})

ipcMain.on("restart", async (_event) => {
  jsonator({apps:""}, true, () => {
    app.relaunch()
    app.quit()
  })
})

// to think about/do
// 4k screens
// how do i do a tutorial (pdf?)
// error reporter

// Tests to do

// identified bugs
// random error about display names appeared once
// cant exit settings whilst icons are being generated
// icons overwrote the settings file

// performance review
// slow downs when starting and when updating json
// DO NOT LET IT PAUSE ON OPENING
// 2 seconds load 1
// 4 seconds load 4
// 1 second load 6
// 3 seconds of white 