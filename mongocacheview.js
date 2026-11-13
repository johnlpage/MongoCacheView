//Main Loop

db = db.getSiblingDB("admin")

function isAtlasConnection() {
    hosts = ""
    try {
        hosts += " " + db.getMongo().host
    } catch (e) {
        // The connection's host property is not available in every shell version.
    }
    try {
        serverStatus = db.adminCommand({serverStatus:1})
        if (serverStatus.ok && serverStatus.host) {
            hosts += " " + serverStatus.host
        }
    } catch (e) {
        // Atlas detection can still use the connection host if serverStatus is restricted.
    }
    return /\.mongodb\.net\b/i.test(hosts)
}

atlasConnection = isAtlasConnection()

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
            pagesUsed:0,
            pagesRead:0,
            sampleTime:0
            })
        }
        collectionInfos.push({db:dbNames[d],
            coll:collectionNames[c],
            inCache:0,
            cacheRead:0,
            cacheWrite:0,
            pagesUsed:0,
            pagesRead:0,
            sampleTime:0,
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
        header = formatName("Collection", collectionColumnWidth) + " " +
            padLeft("Size", 10) + " " + padLeft("Cached", 10) + " " +
            padLeft("%age", 6) + " " + padLeft("Delta", 8) + " " +
            (atlasConnection ? padLeft("RdMB/s", 8) + " " + padLeft("WrMB/s", 8) + " " +
                padLeft("RdIOPS", 8) + " " + padLeft("WrIOPS", 8) :
                padLeft("Read", 8) + " " + padLeft("Written", 9)) + " " + "Used"
        print(header)

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
        cacheRead = collStats["wiredTiger"]["cache"]["bytes read into cache"]
        cacheWrite = collStats["wiredTiger"]["cache"]["bytes written from cache"]
        pagesUsed = collStats["wiredTiger"]["cache"]["pages requested from the cache"]
        pagesRead = collStats["wiredTiger"]["cache"]["pages read into cache"]
        collSize = collStats["size"] + collStats['totalIndexSize']
        //Compute diffs
        sampleTime = new Date().getTime()
        elapsed = collInfo.sampleTime > 0 ? (sampleTime - collInfo.sampleTime) / 1000 : 0
        sizeDiff = Math.round((inCache - collInfo.inCache)/reportTime)
        readRate = elapsed > 0 ? (cacheRead - collInfo.cacheRead) / mb / elapsed : 0
        writeRate = elapsed > 0 ? (cacheWrite - collInfo.cacheWrite) / mb / elapsed : 0
        readIops = elapsed > 0 ? (pagesRead - collInfo.pagesRead) / elapsed : 0
        writeIops = writeRate * 4
        pageUseDiff = Math.round((pagesUsed - collInfo.pagesUsed)/Math.max(elapsed, reportTime))

        name = formatName(collInfo.db + "." + collInfo.coll, collectionColumnWidth)

        if(collSize > 0) {
            pc = Math.round((inCache / collSize) * 100)
            line = name + " " + padLeft(Math.round(collSize), 10) + " " +
                padLeft(inCache, 10) + " " + padLeft(pc, 6) + " " +
                padLeft(sizeDiff, 8) + " "
            if (atlasConnection) {
                line += padLeft(Math.round(readRate * 100) / 100, 8) + " " +
                    padLeft(Math.round(writeRate * 100) / 100, 8) + " " +
                    padLeft(Math.round(readIops), 8) + " " +
                    padLeft(Math.round(writeIops), 8) + " "
            } else {
                line += padLeft(Math.round(readRate), 8) + " " +
                    padLeft(Math.round(writeRate), 9) + " "
            }
            print(line + pageUseDiff)
        }
        collectionInfos[c].inCache = inCache
        collectionInfos[c].cacheRead = cacheRead
        collectionInfos[c].cacheWrite = cacheWrite
        collectionInfos[c].pagesUsed = pagesUsed
        collectionInfos[c].pagesRead = pagesRead
        collectionInfos[c].sampleTime = sampleTime

        // print index stats
        for(i=0;i<collInfo.indexesInfo.length;i++){
            indexInfo = collInfo.indexesInfo[i]
            nameIndex = indexInfo.name
            indexStats = collStats.indexDetails[nameIndex]
            if(indexStats["cache"]) {
  
            indexInCache = Math.round(indexStats["cache"]["bytes currently in the cache"]/mb)
            indexCacheRead = indexStats["cache"]["bytes read into cache"]
            indexCacheWrite = indexStats["cache"]["bytes written from cache"]
            indexPagesUsed = indexStats["cache"]["pages requested from the cache"]
            indexPagesRead = indexStats["cache"]["pages read into cache"]
            indexSize = collStats.indexSizes[nameIndex]


            //Compute diffs
            indexElapsed = indexInfo.sampleTime > 0 ? (sampleTime - indexInfo.sampleTime) / 1000 : 0
            sizeDiff = Math.round((indexInCache - indexInfo.inCache)/reportTime)
            indexReadRate = indexElapsed > 0 ? (indexCacheRead - indexInfo.cacheRead) / mb / indexElapsed : 0
            indexWriteRate = indexElapsed > 0 ? (indexCacheWrite - indexInfo.cacheWrite) / mb / indexElapsed : 0
            indexReadIops = indexElapsed > 0 ? (indexPagesRead - indexInfo.pagesRead) / indexElapsed : 0
            indexWriteIops = indexWriteRate * 4
            pageUseDiff = Math.round((indexPagesUsed - indexInfo.pagesUsed)/Math.max(indexElapsed, reportTime))

            nameTab = formatName("    " + nameIndex, collectionColumnWidth)
            if(indexSize > 0) {
                pc = Math.round((indexInCache / indexSize) * 100)
                line = nameTab + " " + padLeft(Math.round(indexSize), 10) + " " +
                    padLeft(indexInCache, 10) + " " + padLeft(pc, 6) + " " +
                    padLeft(sizeDiff, 8) + " "
                if (atlasConnection) {
                    line += padLeft(Math.round(indexReadRate * 100) / 100, 8) + " " +
                        padLeft(Math.round(indexWriteRate * 100) / 100, 8) + " " +
                        padLeft(Math.round(indexReadIops), 8) + " " +
                        padLeft(Math.round(indexWriteIops), 8) + " "
                } else {
                    line += padLeft(Math.round(indexReadRate), 8) + " " +
                        padLeft(Math.round(indexWriteRate), 9) + " "
                }
                print(line + pageUseDiff)
            }

            collectionInfos[c].indexesInfo[i].inCache = indexInCache
            collectionInfos[c].indexesInfo[i].cacheRead = indexCacheRead
            collectionInfos[c].indexesInfo[i].cacheWrite = indexCacheWrite
            collectionInfos[c].indexesInfo[i].pagesUsed = indexPagesUsed
            collectionInfos[c].indexesInfo[i].pagesRead = indexPagesRead
            collectionInfos[c].indexesInfo[i].sampleTime = sampleTime
        }
        }
    }
    sleep(reportTime * 1000)

}
