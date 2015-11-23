Zotero.Library.prototype.fetchTags = function(config){
	Z.debug("Zotero.Library.fetchTags", 3);
	var library = this;
	var defaultConfig = {
		target:'tags',
		order:'title',
		sort:'asc',
		limit: 100
	};
	var newConfig = J.extend({}, defaultConfig, config);
	var urlconfig = J.extend({
		'target':'tags',
		'libraryType':this.libraryType,
		'libraryID':this.libraryID
	}, newConfig);
	
	return Zotero.ajaxRequest(urlconfig);
};

Zotero.Library.prototype.loadTags = function(config={}){
	Z.debug("Zotero.Library.loadTags", 3);
	var library = this;
	
	if(config.showAutomaticTags && config.collectionKey){
		delete config.collectionKey;
	}
	
	library.tags.displayTagsArray = [];
	return library.fetchTags(config)
	.then(function(response){
		Z.debug('loadTags proxied callback', 3);
		var updatedVersion = response.lastModifiedVersion;
		library.tags.updateSyncState(updatedVersion);
		var addedTags = library.tags.addTagsFromJson(response.data);
		library.tags.updateTagsVersion(updatedVersion);
		library.tags.rebuildTagsArray();
		
		if(response.parsedLinks.hasOwnProperty('next')){
			library.tags.hasNextLink = true;
			library.tags.nextLink = response.parsedLinks['next'];
		}
		else{
			library.tags.hasNextLink = false;
			library.tags.nextLink = null;
		}
		library.trigger("tagsChanged", {library:library});
		return library.tags;
	});
};


Zotero.Library.prototype.loadAllTags = function(config={}){
	Z.debug("Zotero.Library.loadAllTags", 3);
	var library = this;
	var defaultConfig = {target:'tags',
						 order:'title',
						 sort:'asc',
						 limit: 100,
						 libraryType:library.libraryType,
						 libraryID:library.libraryID
					 };
	
	//Build config object that should be displayed next and compare to currently displayed
	var newConfig = J.extend({}, defaultConfig, config);
	var urlconfig = J.extend({}, newConfig);
	var requestUrl = Zotero.ajax.apiRequestString(urlconfig);
	var tags = library.tags;
	
	//check if already loaded tags are okay to use
	var loadedConfig = J.extend({}, defaultConfig, tags.loadedConfig);
	var loadedConfigRequestUrl = tags.loadedRequestUrl;
	Z.debug("requestUrl: " + requestUrl, 4);
	Z.debug('loadedConfigRequestUrl: ' + loadedConfigRequestUrl, 4);
	return new Promise(function(resolve, reject){
		var continueLoadingCallback = function(tags){
			Z.debug("loadAllTags continueLoadingCallback", 3);
			var plainList = Zotero.Tags.prototype.plainTagsList(tags.tagsArray);
			plainList.sort(Zotero.Library.prototype.comparer());
			tags.plainList = plainList;
			
			if(tags.hasNextLink){
				Z.debug("still has next link.", 3);
				tags.tagsArray.sort(Zotero.Tag.prototype.tagComparer());
				plainList = Zotero.Tags.prototype.plainTagsList(tags.tagsArray);
				plainList.sort(Zotero.Library.prototype.comparer());
				tags.plainList = plainList;
				
				var nextLink = tags.nextLink;
				var nextLinkConfig = J.deparam(J.param.querystring(nextLink));
				var newConfig = J.extend({}, config);
				newConfig.start = nextLinkConfig.start;
				newConfig.limit = nextLinkConfig.limit;
				return library.loadTags(newConfig).then(continueLoadingCallback);
			}
			else{
				Z.debug("no next in tags link", 3);
				tags.updateSyncedVersion();
				tags.tagsArray.sort(Zotero.Tag.prototype.tagComparer());
				plainList = Zotero.Tags.prototype.plainTagsList(tags.tagsArray);
				plainList.sort(Zotero.Library.prototype.comparer());
				tags.plainList = plainList;
				Z.debug("resolving loadTags deferred", 3);
				library.tagsLoaded = true;
				library.tags.loaded = true;
				tags.loadedConfig = config;
				tags.loadedRequestUrl = requestUrl;
				
				//update all tags with tagsVersion
				for (var i = 0; i < library.tags.tagsArray.length; i++) {
					tags.tagsArray[i].apiObj.version = tags.tagsVersion;
				}
				
				library.trigger("tagsChanged", {library:library});
				return tags;
			}
		};
		
		resolve( library.loadTags(urlconfig)
		.then(continueLoadingCallback));
	});
};

