/* 
  Copyright 2018. Jefferson "jscher2000" Scher. License: MPL-2.0.
  v1.0 - added drop-down menu for the toolbar button
*/

/**** Event handlers ****/

function menuClick(evt){
	var tgt = evt.target;
	browser.runtime.sendMessage({
		popupaction: tgt.id
	});
	self.close();
}

document.querySelector('ul').addEventListener('click', menuClick, false);
