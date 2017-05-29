module.exports = function(RED) 
{
	"use strict";
	
    var reconnect = RED.settings.sqliteReconnectTime || 20000;
    var sqlite3 = require('sqlite3');
	var util = require('util');
	
	var table = "spool4";
	
	/**
	 * Contains the entirety of Spool's functionality
	 * @param {object} config - the node's configuration object that contains all settings, set for the node in Node-Red interface
	**/
	function SpoolNode(config)
	{
        RED.nodes.createNode(this, config);
		
		this.dbname = config.dbname;
		this.connStatusText = config.connStatusText;
		this.disconnStatusText = config.disconnStatusText;
        var node = this;
		
		var connectionStatus = false;
		var tableIsEmpty = true;
		
		/** Instantiates a database object, connects to database, checks for errors. */
		node.doConnect = function() 
		{
            node.db = new sqlite3.Database(node.dbname);
			
			/** Opens a database connection upon the reception of a respective event, creates an output if successful, create a table structure if it doesn't exist in the database yet. */
            node.db.on('open', function() 
			{
                if (node.tick) { clearTimeout(node.tick); }
                node.log("Opened " + node.dbname + " successfully.");
				
				node.db.run("CREATE TABLE IF NOT EXISTS " + table + " (id INTEGER PRIMARY KEY ASC, msg TEXT)");
            });
			
			/** Detects an error while opening a database, outputs it after a set timeout. */
            node.db.on('error', function(err) 
			{
                node.error("Failed to open " + node.dbname, err + ".");
                node.tick = setTimeout(function() { node.doConnect(); }, reconnect);
            });
        }
		
		/** Closes a database connection upon the reception of a respective event. */
        node.on('close', function () 
		{
            if (node.tick) { clearTimeout(node.tick); }
            if (node.db) { node.db.close(); }
        });
		
		if(node.dbname != "")
		{
		
			node.doConnect();
			
			console.log(config);
			
			/**
			 * Contains the entiriety of the functionality that is executed upon the reception of any input.
			 * @param {object} msg - contents of an input
			**/			
			node.on('input', function(msg) 
			{
				
				if(msg.hasOwnProperty('status'))
				{					
					if(msg.status.text.includes(node.connStatusText)) 
					{ 
						connectionStatus = true;
						
						/** Orders the underlying SQL queries. */
						node.db.serialize(function()
						{
							
							/** 
							 * Retreives all raws existing in the database in the order of their submission, processes them or catches errors.
							 * @param {string} err - error text
							 * @param {string} row - stringified JSON object that has contents of a previously saved input
							**/
							node.db.each("SELECT * FROM " + table + " ORDER BY id ASC", function(err, row)
							{
								if(err)
								{
									node.error(err, msg); 
								}
								else
								{
									
									/** Converts a stringified JSON object back to JSON. */
									var parsedRow = JSON.parse(row.msg);
									
									/** Passes row data downstream. */
									node.send(parsedRow);
									console.log(parsedRow._msgid + " was successfully passed on to the downstream node.");
									
									/** Deletes existing data in the order of its submission, reports or throws an error.
									 * @param {string} err - error text
									**/								
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
							
							/** Stringifies a JSON object of the received input into a storable data type. */
							var stringifiedMsg = JSON.stringify(msg);
									
							/** Stores data that cannot be passed in the database, reports or throws an error.
							 * @param {string} err - error text
							**/
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
			/** Shows error if the path to the database is not properly configured */
			node.error("An sqlite database's path is not configured correctly.");
		}
			
    }
    RED.nodes.registerType('spool', SpoolNode);
	
}
