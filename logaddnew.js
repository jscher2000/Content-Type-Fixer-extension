/* 
  Copyright 2019. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v1.0 - added log and add/edit features for customizing content types
  v1.1 - minor fixes; use template to reduce insertAdjacentHTML
*/

/**** Set up Page -- Get Data from background.js -- Build Table ****/

let arrCT = [];
function refreshLog(blnClear){
	browser.runtime.sendMessage({
		want: "log"
	}).then((oLog) => {
		var dest = document.querySelector('#logbody');
		if (blnClear !== false) dest.innerHTML = '';
		var arrItems = oLog.logarray;
		if (arrItems && arrItems.length > 0){
			var arrExtensions = []; // track file extensions so only one action button appears per extension
			var newTR = document.getElementById('newTR'), clone, row, cells;
			for (var j=0; j<arrItems.length; j++){
				clone = document.importNode(newTR.content, true);
				console.log(clone);
				// Populate the template
				row = clone.querySelector('tr');
				if (arrItems[j].action.indexOf('N/A - ') != -1){
					row.className = 'grayed';
				}
				cells = row.querySelectorAll('td');
				cells[0].textContent = new Date(arrItems[j].time).toLocaleString();
				cells[1].textContent = arrItems[j].url;
				cells[2].textContent = arrItems[j].extension;
				cells[3].querySelector('span').textContent = arrItems[j].action;
				if (!arrExtensions.includes(arrItems[j].extension)){
					// Enable either the Add or Edit button
					cells[3].querySelector('button').setAttribute('fext', arrItems[j].extension);
					if (arrItems[j].action.indexOf('no association for extension') > -1){
						// We're all set with the Add button
					} else {
						if (arrItems[j].action.indexOf('Updated CT header') > -1 || arrItems[j].action.indexOf('Created CT header') > -1 ||
							arrItems[j].action.indexOf('CT already set') > -1){
							// Switch to an Edit button
							cells[3].querySelector('button').setAttribute('fexttype', 'edit');
							cells[3].querySelector('button').setAttribute('title', 'Edit content-type association');
							cells[3].querySelector('button').textContent = 'Edit';
						} else {
							// Remove the Add button?? Not sure how we got here
							console.log('WTF');
							cells[3].querySelector('button').remove();
						}
					}
					arrExtensions.push(arrItems[j].extension);
				} else {
					// Remove the Add button
					cells[3].querySelector('button').remove();
				}
				dest.appendChild(clone);
			}
		} else { // No log data to show in table, display textual message
			if (arrItems && arrItems.length > 0){
				addErrorRow(dest, 'No requests have been logged in the past 5 minutes', 4);
			} else {
				addErrorRow(dest, 'No log data (listening is disabled? no downloads yet?)', 4);
			}
		}
	}).catch((err) => { // No log retrieved, display error message from promise
		addErrorRow(document.querySelector('#logbody'), 'Problem getting log: ' + err.message, 4);
	});
}
function addErrorRow(tgt, msg, intSpan){
	var cell = document.createElement('td');
	cell.setAttribute('colspan', intSpan);
	cell.textContent = msg;
	var row = document.createElement('tr');
	row.appendChild(cell);
	tgt.appendChild(row);
}
function getCTarray(){
	browser.runtime.sendMessage({
		want: "CTarray"
	}).then((oCTarray) => {
		arrCT = oCTarray.CTarray;
	}).catch((err) => {
		console.log('Problem getting CTarray: ' + err.message);
	});
}
getCTarray();
refreshLog(false);
document.querySelector('#btnRefresh').addEventListener('click', refreshLog, false);
document.querySelector('#logbody').addEventListener('click', doButton, false);

/**** Handle Button events that occur in the log table body (Add/Edit/Reset/etc) ****/

function doButton(evt){
	var tgt = evt.target;
	if (tgt.nodeName !== 'BUTTON') return;
	if (tgt.hasAttribute('fexttype')){  // Add or Edit
		// Insert form from template and populate
		switch (evt.target.getAttribute('fexttype')){
			case 'add':
				var t = document.querySelector('#frmAdd');
				break;
			case 'edit':
				var t = document.querySelector('#frmEdit');
				break;
		}
		var clone = document.importNode(t.content, true);
		var fext = tgt.getAttribute('fext');
		clone.querySelector('form > div').setAttribute('fext', fext);
		var els = clone.querySelectorAll('span.fext');
		for (var i=0; i<els.length; i++) els[i].textContent = fext;
		els = clone.querySelectorAll('a[href]');
		for (i=0; i<els.length; i++) els[i].href = els[i].href.replace('%s', fext);
		tgt.parentNode.appendChild(clone); // parent is <td>
		tgt.style.display = 'none';
		// Populate text input with current association, if applicable
		var newCT = arrCT.find( objCT => objCT.ext === fext );
		if (newCT) {
			console.log('newCT => ' + JSON.stringify(newCT));
			tgt.parentNode.querySelector('[name="customCT"]').setAttribute('value', newCT.ct);
			tgt.parentNode.querySelector('[name="ctType"][value="cust"]').checked = true;
			// if this is a built-in association, store that, and disable the Delete button
			if (newCT.builtin == true){
				tgt.parentNode.querySelector('button.delbtn').disabled = true;
			} else {
				tgt.parentNode.querySelector('button.delbtn').setAttribute('currCT', newCT.ct);
				if (newCT.builtin !== false) {
					// display built-in content-type as one of the options
					tgt.parentNode.querySelector('span.builtinspan').style.display = '';
					tgt.parentNode.querySelector('span.builtinspan span.string').textContent = newCT.builtin;
				}
			}
		}
		// Attach focus event to customCT input
		tgt.parentNode.querySelector('[name="customCT"]').addEventListener('focus', function(){
			this.previousElementSibling.checked = true;
		}, false);
	} else if (tgt.className == 'reset') {  // Clear text input changes
		tgt.previousElementSibling.value = tgt.previousElementSibling.getAttribute('value');
	} else {  // Non-submit form actions
		// Process Add, Modify, Delete buttons
		var dCtrls = tgt.closest('div.addedit');
		if (dCtrls){
			// Extract form details
			var fext = dCtrls.getAttribute('fext');
			var oldCT = dCtrls.querySelector('[name="customCT"]').getAttribute('value');
			var rads = dCtrls.querySelectorAll('input[type="radio"][name="ctType"]');
			var axnCT = '';
			var builtin = false;
			for (var i=0; i<rads.length; i++){
				if (rads[i].checked){
					if (rads[i].value == "fext"){
						axnCT = dCtrls.querySelector('input[value="fext"] + span.string').textContent;
					} else if (rads[i].value == "cust"){
						axnCT = dCtrls.querySelector('[name="customCT"]').value.trim();
						// Do a little light validation
						if (axnCT.length === 0){
							alert('Please enter a content-type and try again.')
							return;
						}
						if (axnCT.indexOf('/') < 1){
							alert('Please enter a content-type similar in format to application/whatever and try again.')
							return;
						}
						if (axnCT.indexOf(' ') > -1){
							alert('Please enter a content-type without any spaces and try again.')
							return;
						}
					} else if (rads[i].value == "built"){
						axnCT = dCtrls.querySelector('input[value="built"] + span.string').textContent;
						builtin = true;
					}
					break;
				}
			}
			// Send message to background script
			var oChange;
			switch (tgt.className){
				case 'addbtn':
					oChange = { 
						action: 'add',
						ext: fext,
						ctype: axnCT,
						revert: builtin
					}
					break;
				case 'modbtn':
					// No need to re-add the existing content-type
					if (axnCT == oldCT){
						alert('This content-type is already set up!');
						return;
					}
					oChange = { 
						action: 'change',
						ext: fext,
						ctype: axnCT,
						revert: builtin
					}
					break;
				case 'delbtn':
					// Delete ignores the selected content-type (axnCT)
					if (confirm('Delete current content-type '+ tgt.getAttribute('currCT') + '?')){
						oChange = { 
							action: 'delete',
							ext: fext,
							ctype: axnCT,
							revert: builtin
						}
					} else {
						return;
					}
					break;
			}
			browser.runtime.sendMessage({
				update: oChange
			}).then(() => {
				dCtrls.querySelector('.warning').style.display = '';
				getCTarray(); // ISSUE: not running correctly?
			}).catch((err) => {
				console.log('Problem sending update: ' + err.message);
			});
		} else {
			alert('Problem processing the form for some unknown reason. Sorry.');
		}
	}
}
