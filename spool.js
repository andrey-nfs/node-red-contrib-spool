module.exports = function(RED) 
{
	"use strict";
    var reconnect = RED.settings.sqliteReconnectTime || 20000;
    var sqlite3 = require('sqlite3');
	
	var table = "spool2";
	
	//
	// Opening, checking and closing the db connection, based on the existing SQLite node
	//
	function SpoolNodeDB(config) 
	{
		
        RED.nodes.createNode(this, config);

        this.dbname = config.db;
        var node = this;
		
        node.doConnect = function() 
		{
            node.db = new sqlite3.Database(node.dbname);
            node.db.on('open', function() 
			{
                if (node.tick) { clearTimeout(node.tick); }
                node.log("opened "+node.dbname+" ok");
				
				node.db.run("CREATE TABLE IF NOT EXISTS " + table + " (id TEXT, payload TEXT)");
            });
            node.db.on('error', function(err) 
			{
                node.error("failed to open "+node.dbname, err);
                node.tick = setTimeout(function() { node.doConnect(); }, reconnect);
            });
        }

        node.on('close', function () 
		{
            if (node.tick) { clearTimeout(node.tick); }
            if (node.db) { node.db.close(); }
			
			node.db.run("DROP TABLE  " + table);
        });
		
    }
    RED.nodes.registerType('spooldb', SpoolNodeDB);

	//
	// actual operations with the db
	// 
	function SpoolNode(config)
	{
        RED.nodes.createNode(this, config);
		
		this.mydb = config.mydb;
        this.mydbConfig = RED.nodes.getNode(this.mydb);
		
		var connectionStatus = false;
		var tableIsEmpty = true;
		
		if(this.mydbConfig)
		{
			
			this.mydbConfig.doConnect();
			var node = this;
			
			//
			// TO-DO's
			// 1) monitoring the connection status of a downstream node
			// 2) getting actual data 
			// 3) processing the data based on the connection status (create the structure of the db if there is data to be saved)
			// 4) sending data further if the connection is restored
			//
			node.on('input', function(msg) 
			{
						
				if(msg.hasOwnProperty('status'))
				{
					//console.log(msg);
					
					if(msg.status.text.includes("status.connected")) 
					{ 
						connectionStatus = true;

						node.mydbConfig.db.serialize(function()
						{
							node.mydbConfig.db.each("SELECT * FROM " + table, function(err, row)
							{
								if(err)
								{
									node.error(err,msg); 
								}
								else
								{
									node.mydbConfig.db.serialize(function()
									{
										//console.log(row);
										
										node.send(row.payload);
										console.log(row.id + " was successfully passed on to the downstream node.");
									
										node.mydbConfig.db.run("DELETE FROM " + table + " WHERE id LIKE '%" + row.id + "%'");
										console.log(row.id + " was successfully removed from the database.");
									});									
								}								
							});							
						});						
					}
					else if(msg.status.text.includes("status.disconnected")) { connectionStatus = false; }
				}
				
				if(msg.hasOwnProperty('topic'))
				{
					//console.log(msg);
					
					if(connectionStatus == false)
					{						
						node.mydbConfig.db.serialize(function()
						{							
							node.mydbConfig.db.run("INSERT INTO " + table + " VALUES (?, ?)", msg._msgid, msg.payload);
							
							console.log("A Message (ID: " + msg._msgid + ", Payload: " + msg.payload + ") was successfully stored in the database.");
						});
					}
					
				}
					
			});
			
		}
		else
		{
			this.error("Sqlite database not configured");
		}
			
    }
    RED.nodes.registerType('spool', SpoolNode);
	
}