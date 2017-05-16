module.exports = function(RED) 
{
	"use strict";
	
    var reconnect = RED.settings.sqliteReconnectTime || 20000;
    var sqlite3 = require('sqlite3');
	var util = require('util');
	
	var table = "spool4";
	
	function SpoolNode(config)
	{
        RED.nodes.createNode(this, config);
		
		this.dbname = config.dbname;
		this.connStatusText = config.connStatusText;
		this.disconnStatusText = config.disconnStatusText;
		
        var node = this;
		
		var connectionStatus = false;
		var tableIsEmpty = true;
		
		node.doConnect = function() 
		{
            node.db = new sqlite3.Database(node.dbname);
			
            node.db.on('open', function() 
			{
                if (node.tick) { clearTimeout(node.tick); }
                node.log("Opened " + node.dbname + " successfully.");
				
				node.db.run("CREATE TABLE IF NOT EXISTS " + table + " (id INTEGER PRIMARY KEY ASC, msg TEXT)");
            });
			
            node.db.on('error', function(err) 
			{
                node.error("Failed to open " + node.dbname, err + ".");
                node.tick = setTimeout(function() { node.doConnect(); }, reconnect);
            });
        }

        node.on('close', function () 
		{
            if (node.tick) { clearTimeout(node.tick); }
            if (node.db) { node.db.close(); }
			
			node.db.run("DROP TABLE  " + table);
        });
		
		if(node.dbname != "")
		{
		
			node.doConnect();
			
			console.log(config);
			
			node.on('input', function(msg) 
			{				
				if(msg.hasOwnProperty('status'))
				{					
					if(msg.status.text.includes(node.connStatusText)) 
					{ 
						connectionStatus = true;

						node.db.serialize(function()
						{
							node.db.each("SELECT * FROM " + table + " ORDER BY id ASC", function(err, row)
							{
								if(err)
								{
									node.error(err, msg); 
								}
								else
								{
									var parsedRow = JSON.parse(row.msg);
									
									node.send(parsedRow);
									console.log(parsedRow._msgid + " was successfully passed on to the downstream node.");
								
									node.db.run("DELETE FROM " + table + " WHERE id = ?", row.id, function(err) 
									{
										if(err) throw err;
										
										console.log("Report: " + this.changes + " - " + util.inspect(this, { showHidden: false, depth: null }));

										if(this.changes == 1) console.log(parsedRow._msgid + " was successfully removed from the database.");
										else console.log("Could not remove " + parsedRow._msgid + " from the database.");

									});
								}								
							});							
						});						
					}
					else if(msg.status.text.includes(node.disconnStatusText)) { connectionStatus = false; }
				}
				
				if(msg.hasOwnProperty('topic'))
				{					
					if(connectionStatus == false)
					{						
						node.db.serialize(function()
						{
							var stringifiedMsg = JSON.stringify(msg);
						
							node.db.run("INSERT INTO " + table + " VALUES (NULL, ?)", stringifiedMsg, function(err) 
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
			this.error("An sqlite database's path is not configured correctly.");
		}
			
    }
    RED.nodes.registerType('spool', SpoolNode);
	
}