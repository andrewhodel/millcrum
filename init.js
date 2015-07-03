function addLoadEvent(func) {
  var oldonload = window.onload;
  if (typeof window.onload != 'function') {
    window.onload = func;
  } else {
    window.onload = function() {
      if (oldonload) {
        oldonload();
      }
      func();
    }
  }
}

var toSaveGcode = '';
var clickPaths = [];

addLoadEvent(function() {

	/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
	var saveAs=saveAs||function(e){"use strict";if("undefined"==typeof navigator||!/MSIE [1-9]\./.test(navigator.userAgent)){var t=e.document,n=function(){return e.URL||e.webkitURL||e},o=t.createElementNS("http://www.w3.org/1999/xhtml","a"),r="download"in o,i=function(n){var o=t.createEvent("MouseEvents");o.initMouseEvent("click",!0,!1,e,0,0,0,0,0,!1,!1,!1,!1,0,null),n.dispatchEvent(o)},a=e.webkitRequestFileSystem,c=e.requestFileSystem||a||e.mozRequestFileSystem,u=function(t){(e.setImmediate||e.setTimeout)(function(){throw t},0)},f="application/octet-stream",s=0,d=500,l=function(t){var o=function(){"string"==typeof t?n().revokeObjectURL(t):t.remove()};e.chrome?o():setTimeout(o,d)},v=function(e,t,n){t=[].concat(t);for(var o=t.length;o--;){var r=e["on"+t[o]];if("function"==typeof r)try{r.call(e,n||e)}catch(i){u(i)}}},p=function(e){return/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(e.type)?new Blob(["\ufeff",e],{type:e.type}):e},w=function(t,u){t=p(t);var d,w,y,m=this,S=t.type,h=!1,O=function(){v(m,"writestart progress write writeend".split(" "))},E=function(){if((h||!d)&&(d=n().createObjectURL(t)),w)w.location.href=d;else{var o=e.open(d,"_blank");void 0==o&&"undefined"!=typeof safari&&(e.location.href=d)}m.readyState=m.DONE,O(),l(d)},R=function(e){return function(){return m.readyState!==m.DONE?e.apply(this,arguments):void 0}},b={create:!0,exclusive:!1};return m.readyState=m.INIT,u||(u="download"),r?(d=n().createObjectURL(t),o.href=d,o.download=u,i(o),m.readyState=m.DONE,O(),void l(d)):(e.chrome&&S&&S!==f&&(y=t.slice||t.webkitSlice,t=y.call(t,0,t.size,f),h=!0),a&&"download"!==u&&(u+=".download"),(S===f||a)&&(w=e),c?(s+=t.size,void c(e.TEMPORARY,s,R(function(e){e.root.getDirectory("saved",b,R(function(e){var n=function(){e.getFile(u,b,R(function(e){e.createWriter(R(function(n){n.onwriteend=function(t){w.location.href=e.toURL(),m.readyState=m.DONE,v(m,"writeend",t),l(e)},n.onerror=function(){var e=n.error;e.code!==e.ABORT_ERR&&E()},"writestart progress write abort".split(" ").forEach(function(e){n["on"+e]=m["on"+e]}),n.write(t),m.abort=function(){n.abort(),m.readyState=m.DONE},m.readyState=m.WRITING}),E)}),E)};e.getFile(u,{create:!1},R(function(e){e.remove(),n()}),R(function(e){e.code===e.NOT_FOUND_ERR?n():E()}))}),E)}),E)):void E())},y=w.prototype,m=function(e,t){return new w(e,t)};return"undefined"!=typeof navigator&&navigator.msSaveOrOpenBlob?function(e,t){return navigator.msSaveOrOpenBlob(p(e),t)}:(y.abort=function(){var e=this;e.readyState=e.DONE,v(e,"abort")},y.readyState=y.INIT=0,y.WRITING=1,y.DONE=2,y.error=y.onwritestart=y.onprogress=y.onwrite=y.onabort=y.onerror=y.onwriteend=null,m)}}("undefined"!=typeof self&&self||"undefined"!=typeof window&&window||this.content);"undefined"!=typeof module&&module.exports?module.exports.saveAs=saveAs:"undefined"!=typeof define&&null!==define&&null!=define.amd&&define([],function(){return saveAs});

	var lcanv = document.getElementById("container");

        // we need a Millcrum object to use pointInPolygon
        var localMc = new Millcrum();

        // handle clicks on the canvas
        // we use this to show information about a path
        lcanv.addEventListener("click", function(e) {

                // test if the click was within on of the clickPaths
                for (c=0; c<clickPaths.length; c++) {
                        if (localMc.pointInPolygon([e.pageX-lcanv.offsetLeft,e.pageY-lcanv.offsetTop],clickPaths[c].path)) {
				console.log(clickPaths[c]);
				pathInfoText.innerHTML = 'Cut Type: '+clickPaths[c].cutType+'\nDepth: '+clickPaths[c].depth+'\nDirection: '+clickPaths[c].pathDir+'\nArea: ~'+Math.round(clickPaths[c].signedArea)+'\n';
				pathInfo.style.left = e.pageX-220 + 'px';
				pathInfo.style.top = e.pageY + 'px';
				pathInfo.style.display = 'block';
                        }   
                }   

        });

	// init edit_area
	editAreaLoader.init({id:'millcrumCode',start_highlight:true,allow_resize:'both',toolbar:'undo, redo, select_font, reset_highlight',word_wrap:false,language:'en',syntax:'js'});

	// setup elements
	var generate = document.getElementById('generate');
	var sgc = document.getElementById('saveGcode');
	var smc = document.getElementById('saveMillcrum');
	var omc = document.getElementById('openMillcrum');
	var omc = document.getElementById('openMillcrum');

	var pathInfo = document.getElementById('pathInfo');
	var pathInfoText = document.getElementById('pathInfoText');
	var closePathInfo = document.getElementById('closePathInfo');

	var alertD = document.getElementById('alert');
	var alertText = document.getElementById('alertText');
	var closeAlert = document.getElementById('closeAlert');

	var closeExamples = document.getElementById('closeExamples');
	var examples = document.getElementById('examples');
	var examplesLink = document.getElementById('examplesLink');

	// handle examples
	var ex = document.getElementsByClassName("example");
	for (var i=0; i<ex.length; i++) {
		ex[i].addEventListener('click', function(e) {
			var file = 'examples/' + e.target.id;

			var r = new XMLHttpRequest();
			r.open('GET',file,true);
			r.send();

			r.onreadystatechange = function() {
				if (r.readyState == 4 && r.status == 200) {
					editAreaLoader.setValue('millcrumCode', r.responseText);
					generate.click();
				}
			}

			// close examples window
			examples.style.display = 'none';
		});
	}

	// open examples box on click
	examplesLink.addEventListener('click', function(e) {
		examples.style.left = e.clientX + 'px';
		examples.style.top = e.clientY-250 + 'px';
		examples.style.display = 'block';
		return false;
	});

	// handle closeExamples
	closeExamples.addEventListener('click', function() {
		examples.style.display = 'none';
		return false;
	});

	// handle closePathInfo
	closePathInfo.addEventListener('click', function() {
		pathInfo.style.display = 'none';
		return false;
	});

	// handle closeAlert
	closeAlert.addEventListener('click', function() {
		alertD.style.display = 'none';
		return false;
	});

	// save .gcode
	sgc.addEventListener('click', function() {
		var blob = new Blob([toSaveGcode], {type: 'text/plain;charset=utf-8'});
		saveAs(blob, 'output.gcode');
	});

	// save .millcrum
	smc.addEventListener('click', function() {
		var blob = new Blob([editAreaLoader.getValue('millcrumCode')], {type: 'text/plain;charset=utf-8'});
		saveAs(blob, 'output.millcrum');
	});

	// open .millcrum
	omc.addEventListener('change', function(e) {
		var r = new FileReader();
		r.readAsText(omc.files[0]);
		r.onload = function(e) {
			// load the file
			editAreaLoader.setValue('millcrumCode',r.result);
			// convert the .millcrum to gcode
			generate.click();
		}
	});

	// handle dragging
	var d = document.getElementById('drag');

	drag.addEventListener('dragstart', function(e) {
		var style = window.getComputedStyle(e.target, null);
		e.dataTransfer.setData('text/plain', (parseInt(style.getPropertyValue('left'),10) - e.clientX) + ',' + (parseInt(style.getPropertyValue('top'),10) - e.clientY));
	});

	document.body.addEventListener('dragover', function(e) {
		// prevent the default of just forgetting it
		e.preventDefault();
		return false;
	});

	document.body.addEventListener('drop', function(e) {
		var offset = e.dataTransfer.getData('text/plain').split(',');
		drag.style.left = (e.clientX + parseInt(offset[0],10)) + 'px';
		drag.style.top = (e.clientY + parseInt(offset[1],10)) + 'px';
		e.preventDefault();
		return false;
	});

	// move editor to right side
	d.style.left = window.innerWidth-parseInt(d.style.width)-60 + 'px';

	// handle generate click
	generate.addEventListener("click", function() {

		// remove error, it will regen if it persists
		alertD.style.display = 'none';

		// remove any open pathInfo
		pathInfo.style.display = 'none';

		// reset clickPaths
		clickPaths = [];

		// with edit_area you have to use this to get the textarea contents
		var mcCode = editAreaLoader.getValue('millcrumCode');
		try {
			eval(mcCode);
		} catch (e) {
			// log it to the alert window
			alertText.innerHTML = e;

			// open the alert window
			alertD.style.display = 'block';

			// flash the alert window

			window.setTimeout(function() {
				alertD.style.backgroundColor = '#fff';
			}, 500);

			window.setTimeout(function() {
				alertD.style.backgroundColor = 'red';
			}, 1000);


		}

		// set saveGcode to visible
		sgc.style.display = 'inline';

	});

	// load all_objects.millcrum so users can see what's going on
	document.getElementById('all_objects.millcrum').click();

});
