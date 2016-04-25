'use strict';

var log = require('./Log.js').Logger('libZotero:ApiObject');

module.exports = function(){
	this.instance = 'Zotero.ApiObject';
	this.version = 0;
};

//associate Entry with a library so we can update it on the server
module.exports.prototype.associateWithLibrary = function(library){
	var apiObject = this;
	apiObject.owningLibrary = library;
	if(typeof this.apiObj.library == 'object'){
		this.apiObj.library.type = library.type;
		this.apiObj.library.id = library.libraryID;
	}
	return apiObject;
};

module.exports.prototype.fieldComparer = function(attr){
	if(Intl){
		var collator = new Intl.Collator();
		return function(a, b){
			return collator.compare(a.apiObj.data[attr], b.apiObj.data[attr]);
		};
	} else {
		return function(a, b){
			if(a.apiObj.data[attr].toLowerCase() == b.apiObj.data[attr].toLowerCase()){
				return 0;
			}
			if(a.apiObj.data[attr].toLowerCase() < b.apiObj.data[attr].toLowerCase()){
				return -1;
			}
			return 1;
		};
	}
};
