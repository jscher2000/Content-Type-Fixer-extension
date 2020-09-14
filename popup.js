/* 
  Copyright 2020. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v1.0 - added drop-down menu for the toolbar button
  v1.1 - added content-disposition and autostart options
  v1.5 - support enable/disable of individual Content-Type overrides
  v1.6 - don't apply content-disposition: attachment to text/html unless user overrides
  v1.7 - don't apply content-type changes to text/html unless user overrides
*/

/**** Form setup ****/
let oPrefs = {};
function getPrefs(){
	browser.runtime.sendMessage({
		want: "prefs"
	}).then((oBGprefs) => {
		oPrefs = oBGprefs.prefs;
		document.querySelector('#cd' + oPrefs.dispoAction + ' > span').textContent = '☑';
		if (oPrefs.autostart === true) document.querySelector('#autostart > span').textContent = '☑';
		if (oPrefs.excepthtml === true) document.querySelector('#dispohtml > span').textContent = '☑';
		if (oPrefs.ctexcepthtml === true) document.querySelector('#typehtml > span').textContent = '☑';
	}).catch((err) => {
		console.log('Problem getting oPrefs: ' + err.message);
	});
}
getPrefs();

let arrCT = [];
function getCTarray(){
	browser.runtime.sendMessage({
		want: "CTarray"
	}).then((oCTarray) => {
		arrCT = oCTarray.CTarray;
		refreshCTtable();
	}).catch((err) => {
		console.log('Problem getting CTarray: ' + err.message);
	});
}
getCTarray();

function refreshCTtable(){
	if (!arrCT || arrCT.length === 0) return;
	var dest = document.querySelector('#subview1 tbody');
	// TODO option to clear previous tbody contents
	// Build string array for easier sorting
	var arrCTsortable = [], strTemp = '';
	for (var j=0; j<arrCT.length; j++){
		if (arrCT[j].builtin === true) strTemp = '2|';
		else strTemp = '1|';
		strTemp += arrCT[j].ext + '|' + arrCT[j].ct + '|' + arrCT[j].enabled;
		arrCTsortable.push(strTemp);
	}
	arrCTsortable.sort();
	// Build and insert table rows
	var newTR = document.getElementById('newTR'), clone, row, cells, arrTR = [];
	for (var j=0; j<arrCTsortable.length; j++){
		arrTR = arrCTsortable[j].split('|');
		clone = document.importNode(newTR.content, true);
		// Populate the template
		row = clone.querySelector('tr');
		cells = row.querySelectorAll('td');
		if (arrTR[3] === 'true') cells[0].setAttribute('status', 'on');
		else cells[0].setAttribute('status', 'off');
		if (arrTR[0] === '1') cells[1].className = 'customct';
		cells[1].textContent = arrTR[1];
		cells[2].textContent = arrTR[2];
		dest.appendChild(clone);
	}
}

/**** Event handlers ****/

function menuClick(evt){
	var tgt = evt.target;
	if (tgt.id == 'dispohtml' || tgt.parentNode.id == 'dispohtml'){
		// Toggle value
		oPrefs.excepthtml = !(oPrefs.excepthtml);
		// Send new oPrefs off to the background script
		updatePref();
		if (tgt.id != 'dispohtml') tgt = tgt.parentNode;
		if (oPrefs.excepthtml === true){
			tgt.querySelector('span').textContent = '☑';
		} else {
			tgt.querySelector('span').textContent = '☐';
		}
		return;
	}
	if (tgt.id == 'typehtml' || tgt.parentNode.id == 'typehtml'){
		// Toggle value
		oPrefs.ctexcepthtml = !(oPrefs.ctexcepthtml);
		// Send new oPrefs off to the background script
		updatePref();
		if (tgt.id != 'typehtml') tgt = tgt.parentNode;
		if (oPrefs.ctexcepthtml === true){
			tgt.querySelector('span').textContent = '☑';
		} else {
			tgt.querySelector('span').textContent = '☐';
		}
		return;
	}
	if (tgt.nodeName == 'SPAN') tgt = tgt.closest('li');
	if (tgt.id == 'dispo') return; // no-op
	if (tgt.id == 'autostart'){
		// Toggle value
		oPrefs.autostart = !(oPrefs.autostart);
		// Send new oPrefs off to the background script
		updatePref();
		if (oPrefs.autostart === true){
			tgt.querySelector('span').textContent = '☑';
		} else {
			tgt.querySelector('span').textContent = '☐';
		}
		return;
	}
	if (tgt.id == 'dispoUL' || tgt.closest('ul').id == 'dispoUL'){
		if (tgt.id !== 'cd' + oPrefs.dispoAction){
			oPrefs.dispoAction = tgt.id.slice(2);
			// Send new oPrefs off to the background script
			updatePref();
			// Update the popup
			var list = tgt.closest('ul').querySelectorAll('li[id^="cd"]');
			for (var i=0; i<list.length; i++){
				if (list[i] == tgt){
					list[i].querySelector('span').textContent = '☑';
				} else {
					list[i].querySelector('span').textContent = '☐';
				}
			}
		}
		return;
	}
	if (tgt.classList.contains('hassubview')){
		var subviewdiv = document.querySelector('#' + tgt.getAttribute('opens'));
		if (subviewdiv){
			subviewdiv.style.display = 'block';
			document.getElementById('mainview').style.display = 'none';
		}
		return;
	}
	// Default behavior if none of the above returns
	browser.runtime.sendMessage({
		popupaction: tgt.id
	});
	self.close();		
}
document.querySelector('#ctfmenu').addEventListener('click', menuClick, false);

function updatePref(){
	// Send oPrefs in an update
	browser.runtime.sendMessage({
		prefupdate: oPrefs
	}).catch((err) => {
		console.log('Problem sending update: ' + err.message);
	});
}

/*** Subviews ***/
function backToMain(el){
	var subviewdiv = document.querySelector('#' + el);
	if (subviewdiv){
		subviewdiv.style.display = '';
		document.getElementById('mainview').style.display = '';
	}
}
function subv1Click(evt){
	var tgt = evt.target;
	if (tgt.classList.contains('backtomain')){
		// We want to close this subview
		backToMain(tgt.getAttribute('closes'));
		return;
	} else if (tgt.hasAttribute('status')) {
		// Do Content-Type Override status change
		var oChange;
		if (tgt.getAttribute('status') === 'on'){
			// Update cell attribute to OFF
			tgt.setAttribute('status', 'off');
			// Prepare change object
			oChange = { 
				ext: tgt.nextElementSibling.textContent,
				newstatus: false
			}
		} else {
			// Update cell attribute to ON
			tgt.setAttribute('status', 'on');
			// Prepare change object
			oChange = { 
				ext: tgt.nextElementSibling.textContent,
				newstatus: true
			}
		}
		// Send message to background
		browser.runtime.sendMessage({
			statuschg: oChange
		}).catch((err) => {
			console.log('Problem sending update: ' + err.message);
		});
	} else {
		// What is this?
		console.log(evt);
	}
}
document.getElementById('subview1').addEventListener('click', subv1Click, false);