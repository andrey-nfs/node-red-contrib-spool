module.exports = function(RED) 
{
	"use strict";
    var reconnect = RED.settings.sqliteReconnectTime || 20000;
    var sqlite3 = require('sqlite3');
	var util = require('util');
	
	var table = "spool3";
	
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
                node.log("opened " + node.dbname + " ok");
				
				node.db.run("CREATE TABLE IF NOT EXISTS " + table + " (msg TEXT)");
            });
            node.db.on('error', function(err) 
			{
                node.error("failed to open " + node.dbname, err);
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
			
			node.on('input', function(msg) 
			{
				
				if(msg.hasOwnProperty('status'))
				{					
					if(msg.status.text.includes("status.connected")) 
					{ 
						connectionStatus = true;

						node.mydbConfig.db.serialize(function()
						{
							node.mydbConfig.db.each("SELECT * FROM " + table, function(err, row)
							{
								if(err)
								{
									node.error(err, msg); 
								}
								else
								{
									node.mydbConfig.db.serialize(function()
									{
										var parsedRow = JSON.parse(row.msg);
										
										node.send(parsedRow);
										console.log(parsedRow._msgid + " was successfully passed on to the downstream node.");
									
										node.mydbConfig.db.run("DELETE FROM " + table + " WHERE msg LIKE (?)", "%" + parsedRow._msgid + "%", function(err) 
										{
											if(err) throw err;
											
											console.log("Report: " + this.changes + " - " + util.inspect(this, { showHidden: false, depth: null }));

											if(this.changes == 1) console.log(parsedRow._msgid + " was successfully removed from the database.");
											else console.log("Could not remove " + parsedRow._msgid + " from the database.");

										});									
									});									
								}								
							});							
						});						
					}
					else if(msg.status.text.includes("status.disconnected")) { connectionStatus = false; }
				}
				
				if(msg.hasOwnProperty('topic'))
				{					
					if(connectionStatus == false)
					{						
						node.mydbConfig.db.serialize(function()
						{
							var stringifiedMsg = JSON.stringify(msg);
						
							node.mydbConfig.db.run("INSERT INTO " + table + " VALUES (?)", stringifiedMsg, function(err) 
							{
								if(err) throw err;
								
								console.log("Report: " + this.changes + " - " + util.inspect(this, { showHidden: false, depth: null }));

								if(this.changes == 1) console.log("Message (" + stringifiedMsg + ") was successfully stored in the database.");
								else console.log("Could not store " + msg._msgid + " in the database.");

							});
						});
					}
					else if(connectionStatus == true)
					{
						node.send(msg);
						console.log(msg._msgid + " was successfully passed on to the downstream node.");
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