/* 
  Copyright 2019. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v1.0 - added drop-down menu for the toolbar button
  v1.1 - added content-disposition and autostart options
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
	}).catch((err) => {
		console.log('Problem getting oPrefs: ' + err.message);
	});
}
getPrefs();

/**** Event handlers ****/

function menuClick(evt){
	var tgt = evt.target;
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
			var list = tgt.closest('ul').querySelectorAll('li');
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