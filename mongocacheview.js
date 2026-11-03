//Main Loop

db = db.getSiblingDB("admin")

var dbInfos = db.adminCommand({listDatabases:1, nameOnly: true})

dbNames = []
for(d=0;d<dbInfos.databases.length;d++) {
    dbName = dbInfos.databases[d];
    if (dbName.name == "local" || dbName.name == "config" || dbName.name == "admin") {
        continue;
    }
    dbNames.push(dbName.name)
}

collectionInfos = []

for(d=0;d<dbNames.length;d++){
    collectionNames = db.getSiblingDB(dbNames[d]).getCollectionNames();
    
    for(c=0;c<collectionNames.length;c++) {
        indexesSpec = db.getSiblingDB(dbNames[d]).getCollection(collectionNames[c]).getIndexes();

        indexesInfo = []

        for (i=0;i<indexesSpec.length;i++){
            indexesInfo.push({name:indexesSpec[i].name,
            inCache:0,
            cacheRead:0,
            cacheWrite:0,
            pagesUsed:0
            })
        }
        collectionInfos.push({db:dbNames[d],
            coll:collectionNames[c],
            inCache:0,
            cacheRead:0,
            cacheWrite:0,
            pagesUsed:0,
            indexesInfo:indexesInfo
        })
    }
}

reportTime = 5
collectionColumnWidth = 40

function padRight(value, width) {
    value = String(value)
    return value + Array(Math.max(0, width - value.length) + 1).join(" ")
}

function padLeft(value, width) {
    value = String(value)
    return Array(Math.max(0, width - value.length) + 1).join(" ") + value
}

function formatName(value, width) {
    value = String(value)
    if (value.length > width) {
        value = value.substring(0, width - 3) + "..."
    }
    return padRight(value, width)
}

while(true){
        print('\033[2J')
        print(formatName("Collection", collectionColumnWidth) + " " +
            padLeft("Size", 10) + " " + padLeft("Cached", 10) + " " +
            padLeft("%age", 6) + " " + padLeft("Delta", 8) + " " +
            padLeft("Read", 8) + " " + padLeft("Written", 9) + " " + "Used")

    for(c=0;c<collectionInfos.length;c++) {
        collInfo = collectionInfos[c]
        db = db.getSiblingDB(collInfo.db)
        mb = 1024*1024
        collStats = db.getCollection(collInfo.coll).stats({scale: mb, indexDetails: true})

        if (collInfo.coll.startsWith('system.')) {
            continue;
        }

        if(collStats.hasOwnProperty("codeName") && collStats["codeName"] == "CommandNotSupportedOnView"){
            // stats not supported on view
            continue;
        }

        inCache = Math.round(collStats["wiredTiger"]["cache"]["bytes currently in the cache"]/mb)
        cacheRead = Math.round(collStats["wiredTiger"]["cache"]["bytes read into cache"]/mb)
        cacheWrite = Math.round(collStats["wiredTiger"]["cache"]["bytes written from cache"]/mb)
        pagesUsed = Math.round(collStats["wiredTiger"]["cache"]["pages requested from the cache"])
        collSize = collStats["size"] + collStats['totalIndexSize']
        //Compute diffs
        sizeDiff = Math.round((inCache - collInfo.inCache)/reportTime)
        readDiff = Math.round((cacheRead - collInfo.cacheRead)/reportTime)
        writeDiff = Math.round((cacheWrite - collInfo.cacheWrite)/reportTime)
        pageUseDiff = Math.round((pagesUsed - collInfo.pagesUsed)/reportTime)

        name = formatName(collInfo.db + "." + collInfo.coll, collectionColumnWidth)

        if(collSize > 0) {
            pc = Math.round((inCache / collSize) * 100)
            print(name + " " + padLeft(Math.round(collSize), 10) + " " +
                padLeft(inCache, 10) + " " + padLeft(pc, 6) + " " +
                padLeft(sizeDiff, 8) + " " + padLeft(readDiff, 8) + " " +
                padLeft(writeDiff, 9) + " " + pageUseDiff)
        }
        collectionInfos[c].inCache = inCache
        collectionInfos[c].cacheRead = cacheRead
        collectionInfos[c].cacheWrite = cacheWrite
        collectionInfos[c].pagesUsed = pagesUsed

        // print index stats
        for(i=0;i<collInfo.indexesInfo.length;i++){
            indexInfo = collInfo.indexesInfo[i]
            nameIndex = indexInfo.name
            indexStats = collStats.indexDetails[nameIndex]
            if(indexStats["cache"]) {
  
            indexInCache = Math.round(indexStats["cache"]["bytes currently in the cache"]/mb)
            indexCacheRead = Math.round(indexStats["cache"]["bytes read into cache"]/mb)
            indexCacheWrite = Math.round(indexStats["cache"]["bytes written from cache"]/mb)
            indexPagesUsed = Math.round(indexStats["cache"]["pages requested from the cache"])
            indexSize = collStats.indexSizes[nameIndex]
           

            //Compute diffs
            sizeDiff = Math.round((indexInCache - indexInfo.inCache)/reportTime)
            readDiff = Math.round((indexCacheRead - indexInfo.cacheRead)/reportTime)
            writeDiff = Math.round((indexCacheWrite - indexInfo.cacheWrite)/reportTime)
            pageUseDiff = Math.round((indexPagesUsed - indexInfo.pagesUsed)/reportTime)

            nameTab = formatName("    " + nameIndex, collectionColumnWidth)
            if(indexSize > 0) {
                pc = Math.round((indexInCache / indexSize) * 100)
                print(nameTab + " " + padLeft(Math.round(indexSize), 10) + " " +
                    padLeft(indexInCache, 10) + " " + padLeft(pc, 6) + " " +
                    padLeft(sizeDiff, 8) + " " + padLeft(readDiff, 8) + " " +
                    padLeft(writeDiff, 9) + " " + pageUseDiff)
            }

            collectionInfos[c].indexesInfo[i].inCache = indexInCache
            collectionInfos[c].indexesInfo[i].cacheRead = indexCacheRead
            collectionInfos[c].indexesInfo[i].cacheWrite = indexCacheWrite
            collectionInfos[c].indexesInfo[i].pagesUsed = indexPagesUsed
        }
        }
    }
    sleep(reportTime * 1000)

}
