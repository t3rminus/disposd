'use strict';
const electron = require('electron'),
	path = require('path'),
	url = require('url'),
	app = electron.app,
	BrowserWindow = electron.BrowserWindow,
	ipc = electron.ipcMain,
	MetadataReader = require('./lib/metadata-reader'),
	reader = new MetadataReader('/tmp/shairport-sync-metadata'),
	albumArt = require('album-art');

/**
 * Electron Init
 */
let mainWindow;
function createWindow () {
	// Create the browser window.
	const size = electron.screen.getPrimaryDisplay().workAreaSize;
	const height = Math.floor(size.height * 2 / 3);
	mainWindow = new BrowserWindow({
		x: 0,
		y: Math.floor((size.height - height) / 2),
		width: size.width,
		height: height,
		frame: false,
		backgroundColor: '#444'
		//alwaysOnTop: true
	});
	
	// and load the index.html of the app.
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}));
	
	// Open the DevTools.
	mainWindow.webContents.openDevTools({ mode: 'detach' });
	
	// GC the window when closed
	mainWindow.on('closed', function() {
		mainWindow = null;
	});
}

let lastAlbumName, lastArtist, artworkTimeout;
const doArtwork = function(picture, artist, albumName) {
	if(artworkTimeout) {
		clearTimeout(artworkTimeout);
	}
	if(picture) {
		mainWindow.webContents.send('picture', picture);
	} else if(artist && albumName && (artist != lastArtist || albumName != lastAlbumName)) {
		lastArtist = artist; lastAlbumName = albumName;
		setTimeout(function() {
			albumArt(artist, albumName, 'mega', function(err, url) {
				if(!err) {
					mainWindow.webContents.send('picture', url);
				}
			});
		}, 3000);
	}
};

app.on('ready', createWindow);
app.on('window-all-closed', function() {
	app.quit();
});

reader.on('track', function(data) {
	mainWindow.webContents.send('track', data);
	doArtwork(null, data.artist, data.albumName);
});

reader.on('picture', doArtwork);

reader.on('progress', function(data) {
	mainWindow.webContents.send('progress', data);
});

reader.on('state', function(data) {
	mainWindow.webContents.send('state', data);
});

ipc.on('connected', function(){
	mainWindow.webContents.send('track', reader.metadata);
	if(reader.picture) {
		mainWindow.webContents.send('picture', reader.picture);
	} else if(reader.metadata.artist && reader.metadata.albumName) {
		albumArt(reader.metadata.artist, reader.metadata.albumName, 'mega', function(err, url){
			if(!err) {
				mainWindow.webContents.send('picture', url);
			}
		});
	}
});