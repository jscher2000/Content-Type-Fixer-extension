/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v0.2 - initial design; uses some code from https://github.com/samlh/display-inline (MIT)
  v0.3 - fix unquoted filename's (old ASP on IIS issue)
*/

let nowlistening = false;

// TODO: The following should be built out more and user-extensible
let trueCT = [
	{ ext: "acsm", ct: "application/vnd.adobe.adept+xml" },
	{ ext: "doc", ct: "application/msword" },
	{ ext: "docx", ct: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
	{ ext: "epub", ct: "application/epub+zip" },
	{ ext: "pdf", ct: "application/pdf" },
	{ ext: "ppt", ct: "application/vnd.ms-powerpoint" },
	{ ext: "pptx", ct: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
	{ ext: "psd", ct: "application/vnd.adobe.photoshop" },
	{ ext: "rtf", ct: "application/rtf" },
	{ ext: "xls", ct: "application/vnd.ms-excel" },
	{ ext: "xlsx", ct: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
	{ ext: "zip", ct: "application/zip" }
];

function fixCT(details) { 
	// extract the Content-Type and Content-Disposition headers if present
	let contentTypeHeader, contentDispositionHeader;
	for (let header of details.responseHeaders) {
		switch (header.name.toLowerCase()) {
			case "content-type":
				contentTypeHeader = header;
				console.log('contentTypeHeader.value => ' + contentTypeHeader.value);
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
		console.log('filename from details.url => ' + filename);
	}
	// check for filename in content disposition header (e.g., 'attachment; filename="blahblah.doc"')
	if (contentDispositionHeader) {
		let sections = contentDispositionHeader.value.split(";");
		for (var i=0; i<sections.length; i++) {
			var parts = sections[i].split("=", 2);
			if (parts[0].trim().indexOf('filename') === 0) {
				filename = parts[1].trim();
				if (filename.endsWith('"')) filename = filename.slice(0, -1);
				else if (filename.indexOf(' ') > -1) { 
					// quote the filename (fix for bad IIS ASP code)
					console.log('(fixing quotation marks around filename)');
					if (filename.startsWith('"')) parts[1] = parts[1].replace(filename, filename + '"');
					else parts[1] = parts[1].replace(filename, '"' + filename + '"');
					sections[i] = parts.join('=');
					contentDispositionHeader.value = sections.join(';');
				}
				console.log('filename from content-disposition => ' + filename);
				break;
			}
		}
	}
	// if there's no discernible file name or file extension, exit now
	if (filename === '' || filename.lastIndexOf('.') < 0) return { responseHeaders: details.responseHeaders };
	
	// check file extension for known content-type
	let fileext = filename.substr(filename.lastIndexOf('.')+1);
	console.log('fileext => ' + fileext);
	let newCT = trueCT.find( objCT => objCT.ext === fileext );

	// if we don't have anything to do, we're done
	if (newCT === undefined) return { responseHeaders: details.responseHeaders };
	
	// fix the header
	console.log('newCT.ct => ' + newCT.ct);
	if (contentTypeHeader) contentTypeHeader.value = newCT.ct;
	else details.responseHeaders.push({ name: "Content-Type", value: newCT.ct });
	
	// dispatch headers, we're done
	return { responseHeaders: details.responseHeaders };
}

/* *** CODE RELATED TO TOOLBAR BUTTON *** */

// Listen for button click and turn listener on/off accordingly
browser.browserAction.onClicked.addListener((currTab) => {
	if (nowlistening) { // Disable extension
		// Remove listener
		browser.webRequest.onHeadersReceived.removeListener(fixCT);
		nowlistening = false;
		// Update toolbar button
		setButton();
	} else { // Enable extension
		// Create listener
		browser.webRequest.onHeadersReceived.addListener(
			fixCT,
			{
				urls: ["<all_urls>"],
				types: ["main_frame", "sub_frame"]
			},
			["blocking", "responseHeaders"]
		);		
		nowlistening = true;
		// Update toolbar button
		setButton();
	}
});

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
		browser.browserAction.setTitle({title: 'Turn Content-Type Fixer OFF'});
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

// TODO context menu, options page