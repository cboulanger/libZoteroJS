'use strict';

var log = require('./Log.js').Logger('libZotero:Collections');

module.exports = function(jsonBody){
	var collections = this;
	this.instance = 'Zotero.Collections';
	this.version = 0;
	this.syncState = {
		earliestVersion: null,
		latestVersion: null
	};
	this.collectionObjects = {};
	this.collectionsArray = [];
	this.objectMap = this.collectionObjects;
	this.objectArray = this.collectionsArray;
	this.dirty = false;
	this.loaded = false;
	
	if(jsonBody){
		this.addCollectionsFromJson(jsonBody);
		this.initSecondaryData();
	}
};

 module.exports.prototype = new Zotero.Container();
//build up secondary data necessary to rendering and easy operations but that
//depend on all collections already being present
 module.exports.prototype.initSecondaryData = function(){
	log.debug('Zotero.Collections.initSecondaryData', 3);
	var collections = this;
	
	//rebuild collectionsArray
	collections.collectionsArray = [];
	Object.keys(collections.collectionObjects).forEach(function(key){
		var collection = collections.collectionObjects[key];
		collections.collectionsArray.push(collection);
	});
	
	collections.collectionsArray.sort(Zotero.ApiObject.prototype.fieldComparer('name'));
	collections.nestCollections();
	collections.assignDepths(0, collections.collectionsArray);
};

//take Collection XML and insert a Collection object
 module.exports.prototype.addCollection = function(collection){
	this.addObject(collection);
	return this;
};

 module.exports.prototype.addCollectionsFromJson = function(jsonBody){
	log.debug('addCollectionsFromJson', 3);
	var collections = this;
	var collectionsAdded = [];
	jsonBody.forEach(function(collectionObj){
		var collection = new Zotero.Collection(collectionObj);
		collections.addObject(collection);
		collectionsAdded.push(collection);
	});
	return collectionsAdded;
};

 module.exports.prototype.assignDepths = function(depth, cArray){
	log.debug('Zotero.Collections.assignDepths', 3);
	var collections = this;
	var insertchildren = function(depth, children){
		children.forEach(function(col){
			col.nestingDepth = depth;
			if(col.hasChildren){
				insertchildren((depth + 1), col.children);
			}
		});
	};
	collections.collectionsArray.forEach(function(collection){
		if(collection.topLevel){
			collection.nestingDepth = 1;
			if(collection.hasChildren){
				insertchildren(2, collection.children);
			}
		}
	});
};

 module.exports.prototype.nestedOrderingArray = function(){
	log.debug('Zotero.Collections.nestedOrderingArray', 3);
	var collections = this;
	var nested = [];
	var insertchildren = function(a, children){
		children.forEach(function(col){
			a.push(col);
			if(col.hasChildren){
				insertchildren(a, col.children);
			}
		});
	};
	collections.collectionsArray.forEach(function(collection){
		if(collection.topLevel){
			nested.push(collection);
			if(collection.hasChildren){
				insertchildren(nested, collection.children);
			}
		}
	});
	log.debug('Done with nestedOrderingArray', 3);
	return nested;
};

 module.exports.prototype.getCollection = function(key){
	return this.getObject(key);
};

 module.exports.prototype.remoteDeleteCollection = function(collectionKey){
	var collections = this;
	return collections.removeLocalCollection(collectionKey);
};

 module.exports.prototype.removeLocalCollection = function(collectionKey){
	var collections = this;
	return collections.removeLocalCollections([collectionKey]);
};

 module.exports.prototype.removeLocalCollections = function(collectionKeys){
	var collections = this;
	//delete Collection from collectionObjects
	for(var i = 0; i < collectionKeys.length; i++){
		delete collections.collectionObjects[collectionKeys[i]];
	}
	
	//rebuild collectionsArray
	collections.initSecondaryData();
};

//reprocess all collections to add references to children inside their parents
 module.exports.prototype.nestCollections = function(){
	var collections = this;
	//clear out all child references so we don't duplicate
	collections.collectionsArray.forEach(function(collection){
		collection.children = [];
	});
	
	collections.collectionsArray.sort(Zotero.ApiObject.prototype.fieldComparer('name'));
	collections.collectionsArray.forEach(function(collection){
		collection.nestCollection(collections.collectionObjects);
	});
};

 module.exports.prototype.writeCollections = function(collectionsArray){
	log.debug('Zotero.Collections.writeCollections', 3);
	var collections = this;
	var library = collections.owningLibrary;
	var i;
	
	var config = {
		'target':'collections',
		'libraryType':collections.owningLibrary.libraryType,
		'libraryID':collections.owningLibrary.libraryID
	};
	
	//add collectionKeys to collections if they don't exist yet
	for(i = 0; i < collectionsArray.length; i++){
		var collection = collectionsArray[i];
		//generate a collectionKey if the collection does not already have one
		var collectionKey = collection.get('key');
		if(collectionKey === '' || collectionKey === null) {
			var newCollectionKey = Zotero.utils.getKey();
			collection.set('key', newCollectionKey);
			collection.set('version', 0);
		}
	}

	var writeChunks = collections.chunkObjectsArray(collectionsArray);
	var rawChunkObjects = collections.rawChunks(writeChunks);
	//update collections with server response if successful
	var writeCollectionsSuccessCallback = function(response){
		log.debug('writeCollections successCallback', 3);
		var library = this.library;
		var writeChunk = this.writeChunk;
		library.collections.updateObjectsFromWriteResponse(this.writeChunk, response);
		//save updated collections to collections
		for(var i = 0; i < writeChunk.length; i++){
			var collection = writeChunk[i];
			if(collection.synced && (!collection.writeFailure)) {
				library.collections.addCollection(collection);
				//save updated collections to IDB
				if(Zotero.config.useIndexedDB){
					log.debug('updating indexedDB collections');
					library.idbLibrary.updateCollections(writeChunk);
				}
			}
		}
		response.returnCollections = writeChunk;
		return response;
	};
	
	log.debug('collections.version: ' + collections.version, 3);
	log.debug('collections.libraryVersion: ' + collections.libraryVersion, 3);
	
	var requestObjects = [];
	for(i = 0; i < writeChunks.length; i++){
		var successContext = {
			writeChunk: writeChunks[i],
			library: library
		};
		
		var requestData = JSON.stringify(rawChunkObjects[i]);
		requestObjects.push({
			url: config,
			type: 'POST',
			data: requestData,
			processData: false,
			headers:{
				//'If-Unmodified-Since-Version': collections.version,
				//'Content-Type': 'application/json'
			},
			success: writeCollectionsSuccessCallback.bind(successContext)
		});
	}

	return library.sequentialRequests(requestObjects)
	.then(function(responses){
		log.debug('Done with writeCollections sequentialRequests promise', 3);
		collections.initSecondaryData();
		
		responses.forEach(function(response){
			if (response.isError || ( typeof response.data == "object" && response.data.hasOwnProperty('failed') && Object.keys(response.data.failed).length > 0) ){
				throw new Error('failure when writing collections');
			}
		});
		return responses;
	})
	.catch(function(err){
		log.error(err);
		//rethrow so widget doesn't report success
		throw(err);
	});
};
