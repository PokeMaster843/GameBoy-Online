var inFullscreen = false;
var mainCanvas = null;
var fullscreenCanvas = null;
var showAsMinimal = false;
var keyZones = [
	["right", [39]],
	["left", [37]],
	["up", [38]],
	["down", [40]],
	["a", [88, 74]],
	["b", [90, 81, 89]],
	["select", [16]],
	["start", [13]]
];
var ramInterval = null;
function windowingInitialize() {
	cout("windowingInitialize() called.", 0);
	windowStacks[0] = windowCreate("GameBoy", true);
	windowStacks[1] = windowCreate("terminal", false);
	windowStacks[2] = windowCreate("about", false);
	windowStacks[3] = windowCreate("settings", false);
	windowStacks[4] = windowCreate("input_select", false);
	windowStacks[5] = windowCreate("instructions", false);
	windowStacks[6] = windowCreate("local_storage_popup", false);
	windowStacks[7] = windowCreate("local_storage_listing", false);
	windowStacks[8] = windowCreate("freeze_listing", false);
	windowStacks[9] = windowCreate("save_importer", false);
	mainCanvas = document.getElementById("mainCanvas");
	fullscreenCanvas = document.getElementById("fullscreen");
	try {
		//Hook the GUI controls.
		registerGUIEvents();
	}
	catch (error) {
		cout("Fatal windowing error: \"" + error.message + "\" file:" + error.fileName + " line: " + error.lineNumber, 2);
	}
	//Update the settings to the emulator's default:
	document.getElementById("enable_sound").checked = settings[0];
	document.getElementById("enable_gbc_bios").checked = settings[1];
	document.getElementById("disable_colors").checked = settings[2];
	document.getElementById("rom_only_override").checked = settings[9];
	document.getElementById("mbc_enable_override").checked = settings[10];
	document.getElementById("enable_colorization").checked = settings[4];
	document.getElementById("do_minimal").checked = showAsMinimal;
	document.getElementById("software_resizing").checked = settings[12];
	document.getElementById("typed_arrays_disallow").checked = settings[5];
	document.getElementById("gb_boot_rom_utilized").checked = settings[11];
	document.getElementById("resize_smoothing").checked = settings[13];
    document.getElementById("channel1").checked = settings[14][0];
    document.getElementById("channel2").checked = settings[14][1];
    document.getElementById("channel3").checked = settings[14][2];
    document.getElementById("channel4").checked = settings[14][3];
}
function registerGUIEvents() {
	cout("In registerGUIEvents() : Registering GUI Events.", -1);
	addEvent("click", document.getElementById("terminal_clear_button"), clear_terminal);
	addEvent("click", document.getElementById("local_storage_list_refresh_button"), refreshStorageListing);
	addEvent("click", document.getElementById("terminal_close_button"), function () { windowStacks[1].hide() });
	addEvent("click", document.getElementById("about_close_button"), function () { windowStacks[2].hide() });
	addEvent("click", document.getElementById("settings_close_button"), function () { windowStacks[3].hide() });
	addEvent("click", document.getElementById("input_select_close_button"), function () { windowStacks[4].hide() });
	addEvent("click", document.getElementById("instructions_close_button"), function () { windowStacks[5].hide() });
	addEvent("click", document.getElementById("local_storage_list_close_button"), function () { windowStacks[7].hide() });
	addEvent("click", document.getElementById("local_storage_popup_close_button"), function () { windowStacks[6].hide() });
	addEvent("click", document.getElementById("save_importer_close_button"), function () { windowStacks[9].hide() });
	addEvent("click", document.getElementById("freeze_list_close_button"), function () { windowStacks[8].hide() });
	addEvent("click", document.getElementById("GameBoy_about_menu"), function () { windowStacks[2].show() });
	addEvent("click", document.getElementById("GameBoy_settings_menu"), function () { windowStacks[3].show() });
	addEvent("click", document.getElementById("local_storage_list_menu"), function () { refreshStorageListing(); windowStacks[7].show(); });
	addEvent("click", document.getElementById("freeze_list_menu"), function () { refreshFreezeListing(); windowStacks[8].show(); });
	addEvent("click", document.getElementById("view_importer"), function () { windowStacks[9].show() });
	addEvent("keydown", document, function(event) {
		
		if(event.keyCode == 82) {
			restartByKeyPress();
		}
		
		if(event.keyCode == 187) {
			newRAMWatch();
		}
		
		if(event.keyCode == 189) {
			setMemoryValue();
		}
		
		else {
			keyDown(event);
		}
		
	});
	addEvent("keyup", document,  function (event) {
		if (event.keyCode == 27) {
			//Fullscreen on/off
			fullscreenPlayer();
		}
		else {
			//Control keys / other
			keyUp(event);
		}
	});
	addEvent("change", document.getElementById("tasIn"), importTAS);
	addEvent("MozOrientation", window, GameBoyGyroSignalHandler);
	addEvent("deviceorientation", window, GameBoyGyroSignalHandler);
	new popupMenu(document.getElementById("GameBoy_file_menu"), document.getElementById("GameBoy_file_popup"));
	addEvent("click", document.getElementById("data_uri_clicker"), function () {
		var datauri = prompt("Please input the ROM image's Base 64 Encoded Text:", "");
		if (datauri != null && datauri.length > 0) {
			try {
				cout(Math.floor(datauri.length * 3 / 4) + " bytes of data submitted by form (text length of " + datauri.length + ").", 0);
				initPlayer();
				start(mainCanvas, base64_decode(datauri));
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
	});
	addEvent("click", document.getElementById("set_volume"), function () {
		if (GameBoyEmulatorInitialized()) {
			var volume = prompt("Set the volume here:", "1.0");
			if (volume != null && volume.length > 0) {
				settings[3] = Math.min(Math.max(parseFloat(volume), 0), 1);
				gameboy.changeVolume();
			}
		}
	});
	addEvent("click", document.getElementById("set_speed"), function () {
		if (GameBoyEmulatorInitialized()) {
			var speed = prompt("Set the emulator speed here:", "1.0");
			if (speed != null && speed.length > 0) {
				gameboy.setSpeed(Math.max(parseFloat(speed), 0.001));
			}
		}
	});
	addEvent("click", document.getElementById("internal_file_clicker"), function () {
		var file_opener = document.getElementById("local_file_open");
		windowStacks[4].show();
		file_opener.click();
	});
	addEvent("blur", document.getElementById("input_select"), function () {
		windowStacks[4].hide();
	});
	addEvent("change", document.getElementById("local_file_open"), function () {
		windowStacks[4].hide();
		if (typeof this.files != "undefined") {
			try {
				if (this.files.length >= 1) {
					cout("Reading the local file \"" + this.files[0].name + "\"", 0);
					try {
						//Gecko 1.9.2+ (Standard Method)
						var binaryHandle = new FileReader();
						binaryHandle.onload = function () {
							if (this.readyState == 2) {
								cout("file loaded.", 0);
								try {
									initPlayer();
									start(mainCanvas, this.result);
								}
								catch (error) {
									alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
								}
							}
							else {
								cout("loading file, please wait...", 0);
							}
						}
						binaryHandle.readAsBinaryString(this.files[this.files.length - 1]);
					}
					catch (error) {
						cout("Browser does not support the FileReader object, falling back to the non-standard File object access,", 2);
						//Gecko 1.9.0, 1.9.1 (Non-Standard Method)
						var romImageString = this.files[this.files.length - 1].getAsBinary();
						try {
							initPlayer();
							start(mainCanvas, romImageString);
						}
						catch (error) {
							alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
						}
						
					}
				}
				else {
					cout("Incorrect number of files selected for local loading.", 1);
				}
			}
			catch (error) {
				cout("Could not load in a locally stored ROM file.", 2);
			}
		}
		else {
			cout("could not find the handle on the file to open.", 2);
		}
	});
	addEvent("change", document.getElementById("save_open"), function () {
		windowStacks[9].hide();
		if (typeof this.files != "undefined") {
			try {
				if (this.files.length >= 1) {
					cout("Reading the local file \"" + this.files[0].name + "\" for importing.", 0);
					try {
						//Gecko 1.9.2+ (Standard Method)
						var binaryHandle = new FileReader();
						binaryHandle.onload = function () {
							if (this.readyState == 2) {
								cout("file imported.", 0);
								try {
									import_save(this.result);
									refreshStorageListing();
								}
								catch (error) {
									alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
								}
							}
							else {
								cout("importing file, please wait...", 0);
							}
						}
						binaryHandle.readAsBinaryString(this.files[this.files.length - 1]);
					}
					catch (error) {
						cout("Browser does not support the FileReader object, falling back to the non-standard File object access,", 2);
						//Gecko 1.9.0, 1.9.1 (Non-Standard Method)
						var romImageString = this.files[this.files.length - 1].getAsBinary();
						try {
							import_save(romImageString);
							refreshStorageListing();
						}
						catch (error) {
							alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
						}
						
					}
				}
				else {
					cout("Incorrect number of files selected for local loading.", 1);
				}
			}
			catch (error) {
				cout("Could not load in a locally stored ROM file.", 2);
			}
		}
		else {
			cout("could not find the handle on the file to open.", 2);
		}
	});
	addEvent("click", document.getElementById("restart_cpu_clicker"), function () {
		if (GameBoyEmulatorInitialized()) {
			try {
				if (!gameboy.fromSaveState) {
					initPlayer();
					start(mainCanvas, gameboy.getROMImage());
				}
				else {
					initPlayer();
					openState(gameboy.savedStateFileName, mainCanvas);
				}
			}
			catch (error) {
				alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
			}
		}
		else {
			cout("Could not restart, as a previous emulation session could not be found.", 1);
		}
	});
	addEvent("click", document.getElementById("run_cpu_clicker"), function () {
		run();
	});
	addEvent("click", document.getElementById("kill_cpu_clicker"), function () {
		pause();
	});
	addEvent("click", document.getElementById("save_state_clicker"), function () {
		save();
	});
	addEvent("click", document.getElementById("save_SRAM_state_clicker"), function () {
		saveSRAM();
	});
	addEvent("click", document.getElementById("enable_sound"), function () {
		settings[0] = document.getElementById("enable_sound").checked;
		if (GameBoyEmulatorInitialized()) {
			gameboy.initSound();
		}
	});
	addEvent("click", document.getElementById("disable_colors"), function () {
		settings[2] = document.getElementById("disable_colors").checked;
	});
	addEvent("click", document.getElementById("rom_only_override"), function () {
		settings[9] = document.getElementById("rom_only_override").checked;
	});
	addEvent("click", document.getElementById("mbc_enable_override"), function () {
		settings[10] = document.getElementById("mbc_enable_override").checked;
	});
	addEvent("click", document.getElementById("enable_gbc_bios"), function () {
		settings[1] = document.getElementById("enable_gbc_bios").checked;
	});
	addEvent("click", document.getElementById("enable_colorization"), function () {
		settings[4] = document.getElementById("enable_colorization").checked;
	});
	addEvent("click", document.getElementById("do_minimal"), function () {
		showAsMinimal = document.getElementById("do_minimal").checked;
		fullscreenCanvas.className = (showAsMinimal) ? "minimum" : "maximum";
	});
	addEvent("click", document.getElementById("software_resizing"), function () {
		settings[12] = document.getElementById("software_resizing").checked;
		if (GameBoyEmulatorInitialized()) {
			gameboy.initLCD();
		}
	});
	addEvent("click", document.getElementById("typed_arrays_disallow"), function () {
		settings[5] = document.getElementById("typed_arrays_disallow").checked;
	});
	addEvent("click", document.getElementById("gb_boot_rom_utilized"), function () {
		settings[11] = document.getElementById("gb_boot_rom_utilized").checked;
	});
	addEvent("click", document.getElementById("resize_smoothing"), function () {
		settings[13] = document.getElementById("resize_smoothing").checked;
		if (GameBoyEmulatorInitialized()) {
			gameboy.initLCD();
		}
	});
    addEvent("click", document.getElementById("channel1"), function () {
        settings[14][0] = document.getElementById("channel1").checked;
    });
    addEvent("click", document.getElementById("channel2"), function () {
        settings[14][1] = document.getElementById("channel2").checked;
    });
    addEvent("click", document.getElementById("channel3"), function () {
        settings[14][2] = document.getElementById("channel3").checked;
    });
    addEvent("click", document.getElementById("channel4"), function () {
        settings[14][3] = document.getElementById("channel4").checked;
    });
	addEvent("click", document.getElementById("view_fullscreen"), fullscreenPlayer);
	new popupMenu(document.getElementById("GameBoy_view_menu"), document.getElementById("GameBoy_view_popup"));
	addEvent("click", document.getElementById("view_terminal"), function () { windowStacks[1].show() });
	addEvent("click", document.getElementById("view_instructions"), function () { windowStacks[5].show() });
	addEvent("mouseup", document.getElementById("gfx"), initNewCanvasSize);
	addEvent("resize", window, initNewCanvasSize);
	addEvent("unload", window, function () {
		autoSave();
	});
}
function keyDown(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				GameBoyKeyDown(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}
function keyUp(event) {
	var keyCode = event.keyCode;
	var keyMapLength = keyZones.length;
	for (var keyMapIndex = 0; keyMapIndex < keyMapLength; ++keyMapIndex) {
		var keyCheck = keyZones[keyMapIndex];
		var keysMapped = keyCheck[1];
		var keysTotal = keysMapped.length;
		for (var index = 0; index < keysTotal; ++index) {
			if (keysMapped[index] == keyCode) {
				GameBoyKeyUp(keyCheck[0]);
				try {
					event.preventDefault();
				}
				catch (error) { }
			}
		}
	}
}
function initPlayer() {
	document.getElementById("title").style.display = "none";
	document.getElementById("port_title").style.display = "none";
	document.getElementById("fullscreenContainer").style.display = "none";
}
function fullscreenPlayer() {
	if (GameBoyEmulatorInitialized()) {
		if (!inFullscreen) {
			gameboy.canvas = fullscreenCanvas;
			fullscreenCanvas.className = (showAsMinimal) ? "minimum" : "maximum";
			document.getElementById("fullscreenContainer").style.display = "block";
			windowStacks[0].hide();
		}
		else {
			gameboy.canvas = mainCanvas;
			document.getElementById("fullscreenContainer").style.display = "none";
			windowStacks[0].show();
		}
		gameboy.initLCD();
		inFullscreen = !inFullscreen;
	}
	else {
		cout("Cannot go into fullscreen mode.", 2);
	}
}
function runFreeze(keyName) {
	try {
		windowStacks[8].hide();
		initPlayer();
		openState(keyName, mainCanvas);
	}
	catch (error) {
		cout("A problem with attempting to open the selected save state occurred.", 2);
	}
}
//Wrapper for localStorage getItem, so that data can be retrieved in various types.
function findValue(key) {
	try {
		if (window.localStorage.getItem(key) != null) {
			return JSON.parse(window.localStorage.getItem(key));
		}
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		if (window.globalStorage[location.hostname].getItem(key) != null) {
			return JSON.parse(window.globalStorage[location.hostname].getItem(key));
		}
	}
	return null;
}
//Wrapper for localStorage setItem, so that data can be set in various types.
function setValue(key, value) {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		window.globalStorage[location.hostname].setItem(key, JSON.stringify(value));
	}
}
//Wrapper for localStorage removeItem, so that data can be set in various types.
function deleteValue(key) {
	try {
		window.localStorage.removeItem(key);
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		window.globalStorage[location.hostname].removeItem(key);
	}
}
function outputLocalStorageLink(keyName, dataFound, downloadName) {
	return generateDownloadLink("data:application/octet-stream;base64," + dataFound, keyName, downloadName);
}
function refreshFreezeListing() {
	var storageListMasterDivSub = document.getElementById("freezeListingMasterContainerSub");
	var storageListMasterDiv = document.getElementById("freezeListingMasterContainer");
	storageListMasterDiv.removeChild(storageListMasterDivSub);
	storageListMasterDivSub = document.createElement("div");
	storageListMasterDivSub.id = "freezeListingMasterContainerSub";
	var keys = getLocalStorageKeys();
	while (keys.length > 0) {
		key = keys.shift();
		if (key.substring(0, 7) == "FREEZE_") {
			storageListMasterDivSub.appendChild(outputFreezeStateRequestLink(key));
		}
	}
	storageListMasterDiv.appendChild(storageListMasterDivSub);
}
function outputFreezeStateRequestLink(keyName) {
	var linkNode = generateLink("javascript:runFreeze(\"" + keyName + "\")", keyName);
	var storageContainerDiv = document.createElement("div");
	storageContainerDiv.className = "storageListingContainer";
	storageContainerDiv.appendChild(linkNode)
	return storageContainerDiv;
}
function refreshStorageListing() {
	var storageListMasterDivSub = document.getElementById("storageListingMasterContainerSub");
	var storageListMasterDiv = document.getElementById("storageListingMasterContainer");
	storageListMasterDiv.removeChild(storageListMasterDivSub);
	storageListMasterDivSub = document.createElement("div");
	storageListMasterDivSub.id = "storageListingMasterContainerSub";
	var keys = getLocalStorageKeys();
	var blobPairs = [];
	for (var index = 0; index < keys.length; ++index) {
		blobPairs[index] = getBlobPreEncoded(keys[index]);
		storageListMasterDivSub.appendChild(outputLocalStorageRequestLink(keys[index]));
	}
	storageListMasterDiv.appendChild(storageListMasterDivSub);
	var linkToManipulate = document.getElementById("download_local_storage_dba");
	linkToManipulate.href = "data:application/octet-stream;base64," + base64(generateMultiBlob(blobPairs));
	linkToManipulate.download = "gameboy_color_saves.export";
}
function getBlobPreEncoded(keyName) {
	if (keyName.substring(0, 9) == "B64_SRAM_") {
		return [keyName.substring(4), base64_decode(findValue(keyName))];
	}
	else if (keyName.substring(0, 5) == "SRAM_") {
		return [keyName, convertToBinary(findValue(keyName))];
	}
	else {
		return [keyName, JSON.stringify(findValue(keyName))];
	}
}
function outputLocalStorageRequestLink(keyName) {
	var linkNode = generateLink("javascript:popupStorageDialog(\"" + keyName + "\")", keyName);
	var storageContainerDiv = document.createElement("div");
	storageContainerDiv.className = "storageListingContainer";
	storageContainerDiv.appendChild(linkNode)
	return storageContainerDiv;
}
function popupStorageDialog(keyName) {
	var subContainer = document.getElementById("storagePopupMasterContainer");
	var parentContainer = document.getElementById("storagePopupMasterParent");
	parentContainer.removeChild(subContainer);
	subContainer = document.createElement("div");
	subContainer.id = "storagePopupMasterContainer";
	parentContainer.appendChild(subContainer);
	var downloadDiv = document.createElement("div");
	downloadDiv.id = "storagePopupDownload";
	if (keyName.substring(0, 9) == "B64_SRAM_") {
		var downloadDiv2 = document.createElement("div");
		downloadDiv2.id = "storagePopupDownloadRAW";
		downloadDiv2.appendChild(outputLocalStorageLink("Download RAW save data.", findValue(keyName), keyName));
		subContainer.appendChild(downloadDiv2);
		downloadDiv.appendChild(outputLocalStorageLink("Download in import compatible format.", base64(generateBlob(keyName.substring(4), base64_decode(findValue(keyName)))), keyName));
	}
	else if (keyName.substring(0, 5) == "SRAM_") {
		var downloadDiv2 = document.createElement("div");
		downloadDiv2.id = "storagePopupDownloadRAW";
		downloadDiv2.appendChild(outputLocalStorageLink("Download RAW save data.", base64(convertToBinary(findValue(keyName))), keyName));
		subContainer.appendChild(downloadDiv2);
		downloadDiv.appendChild(outputLocalStorageLink("Download in import compatible format.", base64(generateBlob(keyName, convertToBinary(findValue(keyName)))), keyName));
	}
	else {
		downloadDiv.appendChild(outputLocalStorageLink("Download in import compatible format.", base64(generateBlob(keyName, JSON.stringify(findValue(keyName)))), keyName));
	}
	var deleteLink = generateLink("javascript:deleteStorageSlot(\"" + keyName + "\")", "Delete data item from HTML5 local storage.");
	deleteLink.id = "storagePopupDelete";
	subContainer.appendChild(downloadDiv);
	subContainer.appendChild(deleteLink);
	windowStacks[6].show();
}
function convertToBinary(jsArray) {
	var length = jsArray.length;
	var binString = "";
	for (var indexBin = 0; indexBin < length; indexBin++) {
		binString += String.fromCharCode(jsArray[indexBin]);
	}
	return binString;
}
function deleteStorageSlot(keyName) {
	deleteValue(keyName);
	windowStacks[6].hide();
	refreshStorageListing();
}
function generateLink(address, textData) {
	var link = document.createElement("a");
	link.href = address;
	link.appendChild(document.createTextNode(textData));
	return link;
}
function generateDownloadLink(address, textData, keyName) {
	var link = generateLink(address, textData);
	link.download = keyName + ".sav";
	return link;
}
function checkStorageLength() {
	try {
		return window.localStorage.length;
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		return window.globalStorage[location.hostname].length;
	}
}
function getLocalStorageKeys() {
	var storageLength = checkStorageLength();
	var keysFound = [];
	var index = 0;
	var nextKey = null;
	while (index < storageLength) {
		nextKey = findKey(index++);
		if (nextKey !== null && nextKey.length > 0) {
			if (nextKey.substring(0, 5) == "SRAM_" || nextKey.substring(0, 9) == "B64_SRAM_" || nextKey.substring(0, 7) == "FREEZE_" || nextKey.substring(0, 4) == "RTC_") {
				keysFound.push(nextKey);
			}
		}
		else {
			break;
		}
	}
	return keysFound;
}
function findKey(keyNum) {
	try {
		return window.localStorage.key(keyNum);
	}
	catch (error) {
		//An older Gecko 1.8.1/1.9.0 method of storage (Deprecated due to the obvious security hole):
		return window.globalStorage[location.hostname].key(keyNum);
	}
	return null;
}
//Some wrappers and extensions for non-DOM3 browsers:
function isDescendantOf(ParentElement, toCheck) {
	if (!ParentElement || !toCheck) {
		return false;
	}
	//Verify an object as either a direct or indirect child to another object.
	function traverseTree(domElement) {
		while (domElement != null) {
			if (domElement.nodeType == 1) {
				if (isSameNode(domElement, toCheck)) {
					return true;
				}
				if (hasChildNodes(domElement)) {
					if (traverseTree(domElement.firstChild)) {
						return true;
					}
				}
			}
			domElement = domElement.nextSibling;
		}
		return false;
	}
	return traverseTree(ParentElement.firstChild);
}
function hasChildNodes(oElement) {
	return (typeof oElement.hasChildNodes == "function") ? oElement.hasChildNodes() : ((oElement.firstChild != null) ? true : false);
}
function isSameNode(oCheck1, oCheck2) {
	return (typeof oCheck1.isSameNode == "function") ? oCheck1.isSameNode(oCheck2) : (oCheck1 === oCheck2);
}
function pageXCoord(event) {
	if (typeof event.pageX == "undefined") {
		return event.clientX + document.documentElement.scrollLeft;
	}
	return event.pageX;
}
function pageYCoord(event) {
	if (typeof event.pageY == "undefined") {
		return event.clientY + document.documentElement.scrollTop;
	}
	return event.pageY;
}
function mouseLeaveVerify(oElement, event) {
	//Hook target element with onmouseout and use this function to verify onmouseleave.
	return isDescendantOf(oElement, (typeof event.target != "undefined") ? event.target : event.srcElement) && !isDescendantOf(oElement, (typeof event.relatedTarget != "undefined") ? event.relatedTarget : event.toElement);
}
function mouseEnterVerify(oElement, event) {
	//Hook target element with onmouseover and use this function to verify onmouseenter.
	return !isDescendantOf(oElement, (typeof event.target != "undefined") ? event.target : event.srcElement) && isDescendantOf(oElement, (typeof event.relatedTarget != "undefined") ? event.relatedTarget : event.fromElement);
}
function addEvent(sEvent, oElement, fListener) {
	try {	
		oElement.addEventListener(sEvent, fListener, false);
		cout("In addEvent() : Standard addEventListener() called to add a(n) \"" + sEvent + "\" event.", -1);
	}
	catch (error) {
		oElement.attachEvent("on" + sEvent, fListener);	//Pity for IE.
		cout("In addEvent() : Nonstandard attachEvent() called to add an \"on" + sEvent + "\" event.", -1);
	}
}
function removeEvent(sEvent, oElement, fListener) {
	try {	
		oElement.removeEventListener(sEvent, fListener, false);
		cout("In removeEvent() : Standard removeEventListener() called to remove a(n) \"" + sEvent + "\" event.", -1);
	}
	catch (error) {
		oElement.detachEvent("on" + sEvent, fListener);	//Pity for IE.
		cout("In removeEvent() : Nonstandard detachEvent() called to remove an \"on" + sEvent + "\" event.", -1);
	}
}
function restartByKeyPress() {
	if (GameBoyEmulatorInitialized()) {
		try {
			if (!gameboy.fromSaveState) {
				initPlayer();
				start(mainCanvas, gameboy.getROMImage());
			}
			else {
				initPlayer();
				openState(gameboy.savedStateFileName, mainCanvas);
			}
		}
		catch (error) {
			alert(error.message + " file: " + error.fileName + " line: " + error.lineNumber);
		}
	}
	else {
		cout("Could not restart, as a previous emulation session could not be found.", 1);
	}
}
function newRAMWatch() {
	if(GameBoyEmulatorInitialized()) {
		
		if(ramInterval !== null) { clearInterval(ramInterval); ramInterval = null; }
		var addr = parseInt(prompt("Enter address (hex): "), 16) || 0;
		document.getElementById("adr0").innerHTML = (addr + 0x00).toString(16);
		document.getElementById("adr1").innerHTML = (addr + 0x08).toString(16);
		document.getElementById("adr2").innerHTML = (addr + 0x10).toString(16);
		document.getElementById("adr3").innerHTML = (addr + 0x18).toString(16);
		document.getElementById("adr4").innerHTML = (addr + 0x20).toString(16);
		document.getElementById("adr5").innerHTML = (addr + 0x28).toString(16);
		document.getElementById("adr6").innerHTML = (addr + 0x30).toString(16);
		document.getElementById("adr7").innerHTML = (addr + 0x38).toString(16);
		var v = [document.getElementById("v00"),
		    	 document.getElementById("v01"),
			 document.getElementById("v02"),
			 document.getElementById("v03"),
			 document.getElementById("v04"),
			 document.getElementById("v05"),
			 document.getElementById("v06"),
			 document.getElementById("v07"),
			 document.getElementById("v08"),
			 document.getElementById("v09"),
			 document.getElementById("v0a"),
			 document.getElementById("v0b"),
			 document.getElementById("v0c"),
			 document.getElementById("v0d"),
			 document.getElementById("v0e"),
			 document.getElementById("v0f"),
			 document.getElementById("v10"),
			 document.getElementById("v11"),
			 document.getElementById("v12"),
			 document.getElementById("v13"),
			 document.getElementById("v14"),
			 document.getElementById("v15"),
			 document.getElementById("v16"),
			 document.getElementById("v17"),
			 document.getElementById("v18"),
			 document.getElementById("v19"),
			 document.getElementById("v1a"),
			 document.getElementById("v1b"),
			 document.getElementById("v1c"),
			 document.getElementById("v1d"),
			 document.getElementById("v1e"),
			 document.getElementById("v1f"),
			 document.getElementById("v20"),
			 document.getElementById("v21"),
			 document.getElementById("v22"),
			 document.getElementById("v23"),
			 document.getElementById("v24"),
			 document.getElementById("v25"),
			 document.getElementById("v26"),
			 document.getElementById("v27"),
			 document.getElementById("v28"),
			 document.getElementById("v29"),
			 document.getElementById("v2a"),
			 document.getElementById("v2b"),
			 document.getElementById("v2c"),
			 document.getElementById("v2d"),
			 document.getElementById("v2e"),
			 document.getElementById("v2f"),
			 document.getElementById("v30"),
			 document.getElementById("v31"),
			 document.getElementById("v32"),
			 document.getElementById("v33"),
			 document.getElementById("v34"),
			 document.getElementById("v35"),
			 document.getElementById("v36"),
			 document.getElementById("v37"),
			 document.getElementById("v38"),
			 document.getElementById("v39"),
			 document.getElementById("v3a"),
			 document.getElementById("v3b"),
			 document.getElementById("v3c"),
			 document.getElementById("v3d"),
			 document.getElementById("v3e"),
			 document.getElementById("v3f")];
		ramInterval = setInterval(function() {
			for(var i = 0; i < v.length; i++) {
				v[i].innerHTML = gameboy.memoryRead(addr + i).toString(16);
				v[i].innerHTML = v[i].innerHTML.length >= 2 ? v[i].innerHTML : "0" + v[i].innerHTML;
			}
		}, 1000, false);
		document.getElementById("addr").innerHTML = addr;
		/*document.getElementById("adr0").innerHTML = (addr + 0x00).toString(16);
		document.getElementById("adr1").innerHTML = (addr + 0x08).toString(16);
		document.getElementById("adr2").innerHTML = (addr + 0x10).toString(16);
		document.getElementById("adr3").innerHTML = (addr + 0x18).toString(16);
		document.getElementById("adr4").innerHTML = (addr + 0x20).toString(16);
		document.getElementById("adr5").innerHTML = (addr + 0x28).toString(16);
		document.getElementById("adr6").innerHTML = (addr + 0x30).toString(16);
		document.getElementById("adr7").innerHTML = (addr + 0x38).toString(16);
		if(addr >= 0) {
			document.getElementById("v00").innerHTML = this.memoryRead(addr + 0x00);
			document.getElementById("v01").innerHTML = this.memoryRead(addr + 0x01);
			document.getElementById("v02").innerHTML = this.memoryRead(addr + 0x02);
			document.getElementById("v03").innerHTML = this.memoryRead(addr + 0x03);
			document.getElementById("v04").innerHTML = this.memoryRead(addr + 0x04);
			document.getElementById("v05").innerHTML = this.memoryRead(addr + 0x05);
			document.getElementById("v06").innerHTML = this.memoryRead(addr + 0x06);
			document.getElementById("v07").innerHTML = this.memoryRead(addr + 0x07);
			for(var i = 8; i < 64; i++) {

				var nAddr = addr + i;
				document.getElementById("v" + (addr + i).toString(16)).innerHTML = nAddr <= 0xFF00 ? this.memoryRead(addr).toString(16) : this.memoryHighRead(addr).toString(16);

			}
		}*/
		
	}
}
function setMemoryValue() {
	if(GameBoyEmulatorInitialized()) {
		var writeAddr = parseInt(prompt("Enter address (hex): "), 16) || 0;
		var writeVal = parseInt(prompt("Enter value (hex): ", 16) || 0;
		setTimeout(function() { gameboy.memoryWrite(writeAddr, writeVal); }, 1000);
	}
}
function bits(b) {
	return [b & 0x80, b & 0x40, b & 0x20, b & 0x10, b & 0x08, b & 0x04, b & 0x02, b & 0x01];
}
function importTAS(evt) {
	
	var f = evt.target.files[0], tas;
	var reader = new FileReader();
	reader.onload = function(e) {
		
		var str = e.target.result, i = 0, last = 0, cont = true;
		while(cont) {
			
			tas[i++] = str.substr(last, 8);
			last += 9;
			if(last >= str.length) { cont = false; }
			
		}
		
	};
	
	reader.readAsText(f);
	var count = 0, prev = [0,0,0,0,0,0,0,0];
	var currentTAS = setInterval(function() {
		
		var fr = bits(tas[count++]);
		/*
		if(fr[0] && !prev[0]) { gameboy.JoyPadEvent(4, true); }
		else if(prev[0]) { gameboy.JoyPadEvent(4, false); }
		if(fr[1] && !prev[1]) { gameboy.JoyPadEvent(5, true); }
		else if(prev[1]) { gameboy.JoyPadEvent(5, false); }
		if(fr[2] && !prev[2]) { gameboy.JoyPadEvent(7, true); }
		else if(prev[2]) { gameboy.JoyPadEvent(7, false); }
		if(fr[3] && !prev[3]) { gameboy.JoyPadEvent(6, true); }
		else if(prev[3]) { gameboy.JoyPadEvent(6, false); }
		if(fr[4] && !prev[4]) { gameboy.JoyPadEvent(2, true); }
		else if(prev[4]) { gameboy.JoyPadEvent(2, false); }
		if(fr[5] && !prev[5]) { gameboy.JoyPadEvent(3, true); }
		else if(prev[5]) { gameboy.JoyPadEvent(3, false); }
		if(fr[6] && !prev[6]) { gameboy.JoyPadEvent(1, true); }
		else if(prev[6]) { gameboy.JoyPadEvent(1, false); }
		if(fr[7] && !prev[7]) { gameboy.JoyPadEvent(0, true); }
		else if(prev[7]) { gameboy.JoyPadEvent(0, false); }
		*/
		if(fr[0]) { GameBoyKeyDown("a"); }
		else if(prev[0]) { GameBoyKeyUp("a"); }
		if(fr[1]) { GameBoyKeyDown("b"); }
		else if(prev[1]) { GameBoyKeyUp("b"); }
		if(fr[2]) { GameBoyKeyDown("start"); }
		else if(prev[2]) { GameBoyKeyUp("start"); }
		if(fr[3]) { GameBoyKeyDown("select"); }
		else if(prev[3]) { GameBoyKeyUp("select"); }
		if(fr[4]) { GameBoyKeyDown("up"); }
		else if(prev[4]) { GameBoyKeyUp("up"); }
		if(fr[5]) { GameBoyKeyDown("down"); }
		else if(prev[5]) { GameBoyKeyUp("down"); }
		if(fr[6]) { GameBoyKeyDown("left"); }
		else if(prev[6]) { GameBoyKeyUp("left"); }
		if(fr[7]) { GameBoyKeyDown("right"); }
		else if(prev[7]) { GameBoyKeyUp("right"); }
		/*
		if(fr[0] && !prev[0]) { GameBoyKeyDown("a"); }
		else if(prev[0]) { GameBoyKeyUp("a"); }
		if(fr[1] && !prev[1]) { GameBoyKeyDown("b"); }
		else if(prev[1]) { GameBoyKeyUp("b"); }
		if(fr[2] && !prev[2]) { GameBoyKeyDown("start"); }
		else if(prev[2]) { GameBoyKeyUp("start"); }
		if(fr[3] && !prev[3]) { GameBoyKeyDown("select"); }
		else if(prev[3]) { GameBoyKeyUp("select"); }
		if(fr[4] && !prev[4]) { GameBoyKeyDown("up"); }
		else if(prev[4]) { GameBoyKeyUp("up"); }
		if(fr[5] && !prev[5]) { GameBoyKeyDown("down"); }
		else if(prev[5]) { GameBoyKeyUp("down"); }
		if(fr[6] && !prev[6]) { GameBoyKeyDown("left"); }
		else if(prev[6]) { GameBoyKeyUp("left"); }
		if(fr[7] && !prev[7]) { GameBoyKeyDown("right"); }
		else if(prev[7]) { GameBoyKeyUp("right"); }
		*/
		if(count > tas.length) { clearInterval(currentTAS); }
		prev = fr;
		
	}, 1000 / 60);
	
}
