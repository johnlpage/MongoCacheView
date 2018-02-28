//Main Loop

db = db.getSiblingDB("admin")

var dbInfos = db.adminCommand({listDatabases:1})

dbNames = []
for(d=0;d<dbInfos.databases.length;d++) {
	dbName = dbInfos.databases[d];
	//printjson(dbName);
	dbNames.push(dbName.name)
} 

collectionInfos = []
for(d=0;d<dbNames.length;d++){
	collectionNames = db.getSiblingDB(dbNames[d]).getCollectionNames();
	for(c=0;c<collectionNames.length;c++) {
		//printjson("DB->"+dbNames[d]+" Coll->"+collectionNames[c])
		collectionInfos.push({db:dbNames[d],coll:collectionNames[c],inCache:0,cacheRead:0,cacheWrite:0,pagesUsed:0})
	}
}

//printjson(collectionInfos)
reportTime = 10
while(true){
		print('\033[2J')

		print( "Collection                 \tSize\tCached\t%tage\tDelta\tRead\tWritten\tUsed")
	for(c=0;c<collectionInfos.length;c++) {
	
		collInfo = collectionInfos[c]

	
		db = db.getSiblingDB(collInfo.db)
		mb = 1024*1024
		collStats = db[collInfo.coll].stats(mb)
		//printjson(collStats)
		inCache = Math.floor(collStats["wiredTiger"]["cache"]["bytes currently in the cache"]/mb)
		cacheRead = Math.floor(collStats["wiredTiger"]["cache"]["bytes read into cache"]/mb)
		cacheWrite = Math.floor(collStats["wiredTiger"]["cache"]["bytes written from cache"]/mb)
		pagesUsed = Math.floor(collStats["wiredTiger"]["cache"]["pages requested from the cache"])
		collSize = collStats["size"] + collStats['totalIndexSize']
		//Compute diffs
		sizeDiff = Math.floor((inCache - collInfo.inCache)/reportTime)
		readDiff = Math.floor((cacheRead - collInfo.cacheRead)/reportTime)
		writeDiff = Math.floor((cacheWrite - collInfo.cacheWrite)/reportTime)
		pageUseDiff = Math.floor((pagesUsed - collInfo.pagesUsed)/reportTime)
		name =  collInfo.coll
		name = name + Array(30 - name.length).join(" ")
		if(collSize > 0) {
			pc = Math.floor((inCache / collSize) * 100)
			print( name + "\t" + collSize + "\t" +  inCache + "\t" + pc + "\t" + sizeDiff + "\t" + readDiff + "\t" + writeDiff+"\t"+pageUseDiff)
		}
		collectionInfos[c].inCache = inCache
		collectionInfos[c].cacheRead = cacheRead
		collectionInfos[c].cacheWrite = cacheWrite
		collectionInfos[c].pagesUsed = pagesUsed
			
	}
	sleep(reportTime * 1000)

}
