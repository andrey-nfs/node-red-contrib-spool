node-red-contrib-spool
=========================
[Node-RED](http://nodered.org) node that processes the connectivity status of a downsteam node, saves data when 
it's down, passes it on when it's up, retreives and removes saved data when connection is restored.


Install
-------
Install from [npm](http://npmjs.org)
```
npm install node-red-contrib-spool
```

Usage
-----
This package contains one node tho pass input downstream or stores it depending on the downstream's node connectivity status. 
It needs an existing SQLite database to work.


Query node usage:
-----------------

You will need to fill in the following fields:

1. Path to a database file.
2. Connected message format.
3. Disconnected message format.
4. (Optional) Custom name for the node.


Node usage:
------------------

1. Create a flow that has the following nodes: an input node, a status node, Spool and an output node.
2. Connect the input node and the status node to Spool.
3. Connect Spool to the output node.
4. Configure the status node to only detect changes of the output node connectivity status.
5. Configure Spool according to the connection messages that the output node generates (3 required parameters must be set explicitly).
6. Start passing inputs through the flow.

The following in the general logic of how Spool processes the inputs:

1. If current connection status is "Connected":
1.1 Pass the input message downstream 
1.2 Retreive, pass downstream and remove any data that might be stored in the connected database previously

2. If the status is "Disconnected":
2.1 Don't pass the input data, store it in the connected database until the downstream node's connectivity restoration notice


Authors
-------
* Andrey Ignatyev - [ignatyev@andrey.com.au](mailto:ignatyev@andrey.com.au)
* Mandeep Kaur Sidhu - [m.sidhu@cqumail.com](mailto:m.sidhu@cqumail.com)
