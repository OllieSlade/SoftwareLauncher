const Titlebar = require('custom-electron-titlebar')
const { contextBridge, ipcRenderer, BrowserWindow }  = require("electron")
const fs = require('fs')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ["loadApp", "getApps", "openExplorer", "openWindow", "show-context-menu", "newWindow", "information", "styleToggle", "restart"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["fromMain", "getApps", "information"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        childWindow: (args) => {
            new BrowserWindow(args)
        },
        fileExists: (uri) => {
            if (fs.existsSync(uri)) {
                return true
            } else {
                return false
            }
        }

    }
);

window.addEventListener('DOMContentLoaded', () => {
    new Titlebar.Titlebar({
        backgroundColor: Titlebar.Color.fromHex("#46A3D3"),
        icon: "static\\defaultImage.ico",
        menu: null, 
        titleHorizontalAlignment: "left"
    })
})