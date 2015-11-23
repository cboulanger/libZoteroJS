/*
 * Test cases:
 * create a new item with no children
 *     single POST to /items
 * create a new item with child notes
 *     POST to /items for parent create
 *     POST to /items for children create, items updated with itemKey from last request
 * create a new item with child attachment
 *     POST to /items for parent create
 *     POST to /items for children create, items updated with itemKey from last request
 * update an existing item with no children
 *     PUT to /items/itemKey with parent
 *     (or POST to /items with parent)
 * update an existing item with children but no new children
 *     POST to /items 
 * update an existing item with new children
 */

asyncTest( "Create item", function(){
    expect( 5 );
    console.log("config:");
    console.log(Zotero.config);
    var library = new Zotero.Library(Zotero.testing.libraryType, Zotero.testing.libraryID, '', '');
    
    var item = new Zotero.Item();
    item.associateWithLibrary(library);
    var d = item.initEmpty('conferencePaper');
    d.done(function(item){
        item.set('title', 'GurunGo: coupling personal computers and mobile devices through mobile data types');
        item.set('conferenceName', 'Eleventh Workshop on Mobile Computing Systems & Applications');
        var childNote1 = new Zotero.Item();
        childNote1.initEmptyNote();
        childNote1.set('note', 'Note Content 1');
        
        var childNote2 = new Zotero.Item();
        childNote2.initEmptyNote();
        childNote2.set('note', 'Note Content 2');
        
        item.notes = [];
        item.notes.push(childNote1);
        item.notes.push(childNote2);
        
        var writeItemD = item.writeItem();
        writeItemD.done(function(itemsArray){
            equal(itemsArray.length, 3, "We expect 3 items were written");
            ok(itemsArray[0].itemKey, "We expect the first item to have an itemKey");
            ok(itemsArray[1].itemKey, "We expect the second item to have an itemKey");
            ok(itemsArray[2].itemKey, "We expect the third item to have an itemKey");
            
            //delete the newly created items
            var deleteXhr = library.items.deleteItems(itemsArray);
            deleteXhr.done(function(data, statusText, jqxhr){
                equal(jqxhr.status, 204, "Expect successful delete to respond with 204 no content");
                start();
            });
        });
    }.bind(this) );
});