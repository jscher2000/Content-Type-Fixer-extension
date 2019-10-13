/* 
  Copyright 2019. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v0.2 - initial design; uses some code from https://github.com/samlh/display-inline (MIT)
  v0.3 - fix unquoted filename's (old ASP on IIS issue)
  v1.0 - log script actions while listening (not stored); adding/editing associations
  v1.1 - content-disposition override (initial support), autostart option
  v1.5 - ability to enable/disable individual Content-Type overrides
*/

let nowlistening = false;
let fixCTlog = {};

/**** Create and populate data structure ****/
// Default starting values
let trueCT = [
	{ ext: "acsm", ct: "application/vnd.adobe.adept+xml", builtin: true, enabled: true },
	{ ext: "doc", ct: "application/msword", builtin: true, enabled: true },
	{ ext: "docx", ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", builtin: true, enabled: true },
	{ ext: "epub", ct: "application/epub+zip", builtin: true, enabled: true },
	{ ext: "pdf", ct: "application/pdf", builtin: true, enabled: true },
	{ ext: "ppt", ct: "application/vnd.ms-powerpoint", builtin: true, enabled: true },
	{ ext: "pptx", ct: "application/vnd.openxmlformats-officedocument.presentationml.presentation", builtin: true, enabled: true },
	{ ext: "psd", ct: "application/vnd.adobe.photoshop", builtin: true, enabled: true },
	{ ext: "rar", ct: "application/vnd.rar", builtin: true, enabled: true },
	{ ext: "rtf", ct: "application/rtf", builtin: true, enabled: true },
	{ ext: "xls", ct: "application/vnd.ms-excel", builtin: true, enabled: true },
	{ ext: "xlsx", ct: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", builtin: true, enabled: true },
	{ ext: "zip", ct: "application/zip", builtin: true, enabled: true },
	{ ext: "7z", ct: "application/x-7z-compressed", builtin: true, enabled: true }
];

// Update trueCT from storage
let customCT = [];
function updateCT(){
	browser.storage.local.get("userCT").then((results) => {
		customCT = results.userCT;
		if (customCT != undefined){
			for (var j=0; j<customCT.length; j++){
				let defaultCT = trueCT.find( objCT => objCT.ext === customCT[j].ext );
				if (defaultCT !== undefined){
					defaultCT.builtin = defaultCT.ct;	// is this legal?
					defaultCT.ct = customCT[j].ct;
					defaultCT.enabled = customCT[j].enabled || true;
				} else {
					if (!customCT[j].hasOwnProperty("enabled")) customCT[j].enabled = true;
					trueCT.push(customCT[j]);
				}
			}
		}
	}).catch((err) => {console.log('Error retrieving storage: '+err.message);});
}
updateCT();

// Preferences
let oPrefs = {
	intLogExpiration: 300,		// Seconds after which log entries expire (default to 5 minutes)
	dispoAction: 'browser',		// Content-disposition: 'browser' (do not override), 'inline', 'attachment'
	autostart: false			// Whether to start listening when the extension initializes
};
// Update oPrefs from storage
function updatePref(){
	browser.storage.local.get("userprefs").then((results) => {
		if (results.userprefs != undefined){
			if (JSON.stringify(results.userprefs) != '{}'){
				var arrSavedPrefs = Object.keys(results.userprefs)
				for (var j=0; j<arrSavedPrefs.length; j++){
					oPrefs[arrSavedPrefs[j]] = results.userprefs[arrSavedPrefs[j]];
				}
			}
		}
	}).then(function(){
		if (oPrefs.autostart) startListening();
	}).catch((err) => {console.log('Error retrieving storage: '+err.message);});
}
updatePref();

/**** Fix Headers of Intercepted Responses ****/
function fixCT(details) { 
	// extract the Content-Type and Content-Disposition headers if present
	let contentTypeHeader, contentDispositionHeader;
	for (let header of details.responseHeaders) {
		switch (header.name.toLowerCase()) {
			case "content-type":
				contentTypeHeader = header;
				break;
			case "content-disposition":
				contentDispositionHeader = header;
				break;
		}
	}
	let filename = '';
	// check requested file name (may be overridden by content disposition later)
	if (details.url !== undefined){
		filename = details.url;
		filename = filename.substr(filename.lastIndexOf('/') + 1);
		if (filename.indexOf('?') > -1) filename = filename.substr(0, filename.indexOf('?'));
		if (filename.indexOf('#') > -1) filename = filename.substr(0, filename.indexOf('#'));
	}
	// check for filename in content disposition header (e.g., 'attachment; filename="blahblah.doc"')
	let cdaction = '';
	if (contentDispositionHeader) {
		let sections = contentDispositionHeader.value.split(";");
		for (var i=0; i<sections.length; i++) {
			var parts = sections[i].split("=", 2);
			if (parts[0].trim().toLowerCase().indexOf('filename') === 0) {
				filename = parts[1].trim();
				if (filename.endsWith('"')) filename = filename.slice(0, -1);
				else if (filename.indexOf(' ') > -1) { 
					// quote the filename (fix for bad IIS ASP code)
					cdaction += '<br>C-D: Filename quoted due to spaces';
					if (filename.startsWith('"')) parts[1] = parts[1].replace(filename, filename + '"');
					else parts[1] = parts[1].replace(filename, '"' + filename + '"');
					sections[i] = parts.join('=');
				}
				// console.log('filename from content-disposition => ' + filename);
			} else {
				console.log('sections[i]='+sections[1]);
				if (oPrefs.dispoAction != 'browser'){
					if (sections[i].trim().toLowerCase() != oPrefs.dispoAction){
						cdaction += '<br>C-D: Changed from ' + sections[i] + ' to ' + oPrefs.dispoAction;
						sections[i] = sections[i].replace(/inline|attachment/i, oPrefs.dispoAction);
					}
				}
			}
		}
		contentDispositionHeader.value = sections.join(';');
	} else if (oPrefs.dispoAction == 'attachment'){
		// TODO Should we limit this by content type??
		details.responseHeaders.push({ name: 'Content-Disposition', value: 'attachment' });
		cdaction = '<br>C-D: Forced to attachment';
	}
	// if there's no discernible file name or file extension, exit now
	if (filename === '' || filename.lastIndexOf('.') < 0){
		fixCTlog.enqueue({
			time: Date.now(),
			url: details.url + ' (' + details.type + ')',
			extension: '',
			action: 'C-T: N/A - file extension unavailable' + cdaction
		});
		return { responseHeaders: details.responseHeaders };
	}
	
	let fileext = filename.substr(filename.lastIndexOf('.')+1);
	if (details.statusCode == 200){
		// check file extension for known content-type
		let newCT = trueCT.find( objCT => objCT.ext === fileext );

		// if we don't have anything to do, we're done
		if (newCT === undefined){
			if (contentTypeHeader){
				fixCTlog.enqueue({
					time: Date.now(),
					url: details.url + ' (' + details.type + ')',
					extension: fileext,
					action: 'C-T: No Action - no association for extension; current CT is "' + contentTypeHeader.value + '"' + cdaction
				});
			} else {
				fixCTlog.enqueue({
					time: Date.now(),
					url: details.url + ' (' + details.type + ')',
					extension: fileext,
					action: 'C-T: No Action - no association for extension; CT absent' + cdaction
				});
			}
			return { responseHeaders: details.responseHeaders };
		}
		
		// fix the header
		if (contentTypeHeader){
			if (contentTypeHeader.value !== newCT.ct){
				if (newCT.enabled === true){
					fixCTlog.enqueue({
						time: Date.now(),
						url: details.url + ' (' + details.type + ')',
						extension: fileext,
						action: 'C-T: Updated CT header from "' + contentTypeHeader.value + '" to "' + newCT.ct + '"' + cdaction
					});
					contentTypeHeader.value = newCT.ct;
				} else {
					fixCTlog.enqueue({
						time: Date.now(),
						url: details.url + ' (' + details.type + ')',
						extension: fileext,
						action: 'C-T: No Action - rule to update from "' + contentTypeHeader.value + '" to "' + newCT.ct + '" is disabled' + cdaction
					});
				}
			} else {
				fixCTlog.enqueue({
					time: Date.now(),
					url: details.url + ' (' + details.type + ')',
					extension: fileext,
					action: 'C-T: No Action - CT already set to "' + contentTypeHeader.value + '"' + cdaction
				});
			}
		} else {
			details.responseHeaders.push({ name: "Content-Type", value: newCT.ct });
			fixCTlog.enqueue({
				time: Date.now(),
				url: details.url + ' (' + details.type + ')',
				extension: fileext,
				action: 'C-T: Created CT header with value "' + newCT.ct + '"' + cdaction
			});
		}
	} else {
		fixCTlog.enqueue({
			time: Date.now(),
			url: details.url + ' (' + details.type + ')',
			extension: fileext,
			action: 'C-T: N/A - "' + details.statusLine + '"' + cdaction
		});
	}
	
	// dispatch headers, we're done
	return { responseHeaders: details.responseHeaders };
}

/**** CODE RELATED TO TOOLBAR BUTTON ****/

// Listen for button click and turn listener on/off accordingly
browser.browserAction.onClicked.addListener((currTab) => {
	if (nowlistening) { 	// Show popup (this was previously set up)
		browser.browserAction.openPopup();
	} else { 				// Enable listening/logging/popup
		// Create listener
		startListening();
	}
});

function startListening(){
	browser.webRequest.onHeadersReceived.addListener(
		fixCT,
		{
			urls: ["<all_urls>"],
			types: ["main_frame", "sub_frame", "other"]
		},
		["blocking", "responseHeaders"]
	);		
	nowlistening = true;
	// Update toolbar button
	setButton();
	// Create a new log
	fixCTlog = new Queue();
	// Change button behavior to show popup
	browser.browserAction.setPopup({popup: browser.extension.getURL('popup.html')});
}

// when a window is focused, make sure it has the correct button
browser.windows.onFocusChanged.addListener((wid) => {
	setButton();
});

// Update icon image and tooltip
// https://www.emojione.com/emoji/1f528 ; https://www.emojione.com/licenses
function setButton(){
	if (nowlistening){
		browser.browserAction.setIcon({
			path: {
				16: "icons/hammer-16-star.png",
				32: "icons/hammer-32-star.png"
			}
		});
		browser.browserAction.setTitle({title: 'Turn Content-Type Fixer OFF or Add/Edit Content Types'});
	} else {
		browser.browserAction.setIcon({
			path: {
				16: "icons/hammer-16-Zzzz.png",
				32: "icons/hammer-32-Zzzz.png"
			}
		});
		browser.browserAction.setTitle({title: 'Turn Content-Type Fixer ON'});
	}
}

/**** CODE RELATED TO MESSAGES FROM OTHER PAGES ****/

// Handle Popup menu and form actions 
function handleMessage(request, sender, sendResponse) {
	if ('popupaction' in request) {
		// do the user's bidding
		if (request.popupaction == "turnoff") {			// Disable listening/logging/popup
			// Remove listener
			browser.webRequest.onHeadersReceived.removeListener(fixCT);
			nowlistening = false;
			// Update toolbar button
			setButton();
			// Clear log
			fixCTlog = {};
			// Remove popup from button
			browser.browserAction.setPopup({popup: ''});
			return true;
		} else if (request.popupaction == 'addnew') {	// Show log page
			var creating = browser.tabs.create({ url: '/logaddnew.html' });
			return true;
		}
	} else if ('want' in request) {
		if (request.want == "log") {					// Return log to log page
			if (Object.keys(fixCTlog).length > 0) {
				// Expire old entries
				expireQ(fixCTlog, 'time', oPrefs.intLogExpiration);
				sendResponse({
					logarray: fixCTlog.lifo()
				});
			} else {
				sendResponse({
					error: 'No log available (not listening?)'
				});
			}
			return true;
		}
		if (request.want == "CTarray") {				// Return trueCT to log page
			sendResponse({
				CTarray: trueCT
			});
			return true;
		}
		if (request.want == "prefs") {					// Return oPrefs to popup
			sendResponse({
				prefs: oPrefs
			});
			return true;
		}
	} else if ('prefupdate' in request){
		// Take what the popup sends us, assume it's valid
		oPrefs = request.prefupdate;
		browser.storage.local.set({userprefs: oPrefs})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	} else if ('update' in request) {
		// receive CT update, store to customCT and commit to storage, update trueCT
		var oChange = request['update'];
		if (customCT === undefined) customCT = [];
		//console.log('oChange => ' + JSON.stringify(oChange));
		//console.log('customCT before => ' + JSON.stringify(customCT));
		//console.log('trueCT before => ' + JSON.stringify(trueCT));
		switch (oChange.action){
			case 'add':
				// push to customCT
				customCT.push({
					ext: oChange.ext, 
					ct: oChange.ctype, 
					builtin: false,
					enabled: true
				});
				// push to trueCT
				trueCT.push({
					ext: oChange.ext, 
					ct: oChange.ctype, 
					builtin: false,
					enabled: true
				});
				break;
			case 'change':
				// get a reference to the existing element in customCT
				var oCustCT = customCT.find( objCT => objCT.ext === oChange.ext );
				var oTrueCT = trueCT.find( objCT => objCT.ext === oChange.ext );
				if (oCustCT){
					if (oChange.revert){
						// delete from customCT
						customCT.splice(customCT.findIndex( objCT => objCT.ext === oChange.ext ), 1);
						// revert in trueCT
						if (oTrueCT.builtin !== true && oTrueCT.builtin !== false){
							oTrueCT.ct = oTrueCT.builtin;
							oTrueCT.builtin = true;
						} else {
							console.log('WTF: received revert but old ct not in trueCT.builtin!');
						}
					} else {
						// modify ct in customCT
						oCustCT.ct = oChange.ctype;
						// modify ct in trueCT
						if (oTrueCT.builtin == true){
							oTrueCT.builtin = oTrueCT.ct;
							oTrueCT.builtin = false;
						}
						oTrueCT.ct = oChange.ctype;
					}
				} else {
					// add as custom
					customCT.push({
						ext: oChange.ext, 
						ct: oChange.ctype, 
						builtin: false,
						enabled: true
					});
					if (oTrueCT){
						// modify ct in trueCT
						if (oTrueCT.builtin == true){
							oTrueCT.builtin = oTrueCT.ct;
							oTrueCT.builtin = false;
						}
						oTrueCT.ct = oChange.ctype;					} else {
						// add to trueCT (this shouldn't happen?)
						trueCT.push({
							ext: oChange.ext, 
							ct: oChange.ctype, 
							builtin: false,
							enabled: true
						});
					}
				}
				break;
			case 'delete':
				// delete the existing element in customCT
				customCT.splice(customCT.findIndex( objCT => objCT.ext === oChange.ext ), 1);
				// cleanup trueCT
				var oTrueCT = trueCT.find( objCT => objCT.ext === oChange.ext );
				if (oTrueCT.builtin === false){
					// delete the custom element from trueCT
					trueCT.splice(trueCT.findIndex( objCT => objCT.ext === oChange.ext ), 1);
				} else if (oTrueCT.builtin !== true) {
					// restore default ct
					oTrueCT.ct = oTrueCT.builtin;
					oTrueCT.builtin = true;
				}
				break;
		}
		//console.log('customCT after => ' + JSON.stringify(customCT));
		//console.log('trueCT after => ' + JSON.stringify(trueCT));
		browser.storage.local.set({userCT: customCT})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	} else if ('statuschg' in request) {
		// receive CT status change, store to customCT and commit to storage, update trueCT
		var oChange = request['statuschg'];
		if (customCT === undefined) customCT = [];
		//console.log('oChange => ' + JSON.stringify(oChange));
		// modify ct in customCT
		var oCustCT = customCT.find( objCT => objCT.ext === oChange.ext );
		if (oCustCT) oCustCT.enabled = oChange.newstatus;
		// modify ct in trueCT
		var oTrueCT = trueCT.find( objCT => objCT.ext === oChange.ext );
		oTrueCT.enabled = oChange.newstatus;
		// Update storage
		browser.storage.local.set({userCT: customCT})
			.catch((err) => {console.log('Error on browser.storage.local.set(): '+err.message);});
	}
}
browser.runtime.onMessage.addListener(handleMessage);

/**** CODE RELATED TO RESPONSE LOGGING / PURGING ****/

// Next function from Queue.js - Created by Kate Morley - http://code.iamkate.com/javascript/queues/ - CC0 License

function Queue(){
	var queue = [], offset = 0;
	this.getLength = function(){ return (queue.length - offset); }
	this.isEmpty = function(){ return (queue.length == 0); }
	this.enqueue = function(item){ queue.push(item); }
	this.dequeue = function(){
	if (queue.length == 0) return undefined;
		var item = queue[offset];
		// increment the offset and remove the free space if necessary
		if (++ offset * 2 >= queue.length){
			queue  = queue.slice(offset);
			offset = 0;
		}
		return item;
	}
	this.peek = function(){ return (queue.length > 0 ? queue[offset] : undefined); }
	this.lifo = function(){
		var copy = queue.slice(offset);
		return copy.reverse();
	}
}

// Clear expired items; default to 5 minutes

function expireQ(oQueue, strTimeProp, intSecs){
	// Check the parameters
	if (typeof oQueue !== 'object' || typeof strTimeProp === 'undefined'){
		console.log('expireQ terminated due to a problem with the queue object name or a missing time property name');
		return;
	}
	if (typeof intSecs === 'undefined' || isNaN(intSecs) || intSecs < 0) intSecs = (5 * 60);
	// Plow through the queue until no old items remain
	var oItem, dItem;
	while (!oQueue.isEmpty()){
		oItem = oQueue.peek();
		if (strTimeProp in oItem){
			dItem = new Date(oItem[strTimeProp]);
			if (!isNaN(dItem.getTime())){
				if ((Date.now() - dItem.getTime()) > (intSecs * 1000)){
					oQueue.dequeue(); // remove item from queue
				} else break; // No more old items
			} else {
				console.log('expireQ terminated because this is not a valid date-time: ' + oItem[strTimeProp]);
				break;
			}
		} else {
			console.log('expireQ terminated because the ' + strTimeProp + ' property was not found in the queue item: ' + JSON.stringify(oItem));
			break;
		}
	}
}
