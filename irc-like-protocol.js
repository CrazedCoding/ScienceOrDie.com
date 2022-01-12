
const { render_captcha } = require('./render.js')
const WebSocket = require('ws')
const max_channel_size = 8;
const start_date = new Date()
function help_message() {
	const delta = new Date().getTime()-start_date.getTime()
	return "Server online since: "+start_date+"\n"+
	"Uptime: "+delta/1E9+" seconds.\n"+
	"====== Commands ======\n\n" +
	"Commands are space-delimited strings, and {strings} strings are non-space-delimited strings, in the following formats:\n\n\n" +
	"/nick name - Attempts to reserve \"name\" (limited to regex: [A-z0-9][A-z0-9]*) as your name. You cannot change your name once you've joined a channel.\n\n" +
	"/list - Fetches the publicly available channel list or, if you've already joined a channel, feteches the names of other users in that channel.\n\n" +
	"/join channel [password] - Attempts to join or create channel (limited to regex: [A-z0-9][A-z0-9]*), optionally with password (also limited to regex: [A-z0-9][A-z0-9]*).\n\n" +
	"/say {message} - Says base64-encoded string message {message} in the currently joined channel.\n\n" +
	"/part - If in a channel, then parts that channel; closes the server connection otherwise.\n\n" +
	"/help [command] - Shows this message, or, optionally, information on how to use command.\n\n" +
	"Example: '/help nick'\n\n" +
	"Server responses are JSON encoded strings.\n" +
	"====== End of Commands ======\n\n" +
	"Enter a command, or '/help' for a list of commands..."
}

exports.create = function () {
	var users = []
	var channels = []

	function Channel(name, password) {
		this.name = name;
		this.password = password;
		this.users = []
	}

	Channel.prototype.userJoin = function (user) {
		if(this.users.length >= max_channel_size) {
			user.client.send(JSON.stringify({ error: 'Channel "'+this.name+'" is at max capacity.' }));
		} else {
			this.users.push(user)
			user.channel = this
			const user_list = this.users.map((u)=>{return {name:u.name, ip:u.client.remoteAddress}})
			this.users.forEach((u)=>u.client.send(JSON.stringify({channel:this.name, users:user_list})));
		}
	}

	Channel.prototype.userLeave = function (user) {
		this.users.forEach((u)=>u.client.send(JSON.stringify({part:user.name, ip:user.client.remoteAddress})));
		this.users = this.users.filter((u)=>u.name != user.name)
		user.channel = undefined
	
		if(this.users.length == 0) {
			const this_name = this.name
			channels = channels.filter((channel)=>channel.name != this_name)
		}
	}

	function User(client) {
		this.client = client;
		this.assignRandomName();
		this.channel = null;
	}

	User.prototype.joinChannel = function (name, password) {

		const regex = /[A-z0-9][A-z0-9]*/;
		const found = name.match(regex);
		if (!found || !found.length && found[0].length != name.length) {
			this.client.send(JSON.stringify({ error: 'Invalid channel name. Please use the following regular expression:\n'+regex}));
			return;
		}

		for (const channel of channels) {
			if (channel.name == name) {
				if(!channel.password && password) {
					this.client.send(JSON.stringify({ error: 'Channel does not have a password.' }));
					return;
				} else if((channel.password && !password) || (channel.password && channel.password != password)) {
					this.client.send(JSON.stringify({ error: 'Invalid password.' }));
					return;
				} else {
					channel.userJoin(this)
					return;
				}
			}
		}
		const channel = new Channel(name, password)
		channels.push(channel)
		channel.userJoin(this)
	}

	User.prototype.say = function (message) {
		if(!this.channel) {
			this.send(JSON.stringify({ error: 'Cannot say anything while not in a channel. Please enter "/help join" for more details...' }));
		} else {
			const our_name = this.name;
			const our_ip = this.client.remoteAddress;
			this.channel.users.forEach((user)=>{ 
				user.client.send(JSON.stringify({sayer:our_name, says:message, ip:our_ip}))
			});
		}
	}

	User.prototype.assignRandomName = function () {
		var name = "User" + Math.floor(Math.random() * 999999)
		for (const user of users) {
			if (user.name === name) {
				this.assignRandomName();
				return;
			}
		}
		this.assignName(name);
	}

	User.prototype.assignName = function (name) {
		for (const user of users) {
			if (user.name === name) {
				this.client.send(JSON.stringify({ error: "Nickname '"+name+"' already reserverd."}));
			}
		}
		const regex = /[A-z0-9][A-z0-9]*/;
		const found = name.match(regex);
		if (found && found.length > 0 && found[0].length == name.length) {
			this.name = name;
			this.client.send(JSON.stringify({ nickname: name }));
			return name;
		}
		else
			this.client.send(JSON.stringify({ error: "Invalid nickname. Please use the following regular expression:\n"+regex }));
	};

	return function (client) {
		console.info(client.remoteAddress, 'IRC-Like connection established.');
		client.challenge = render_captcha()
		client.send(JSON.stringify({ challenge: 'data:image/png;base64,' + client.challenge.image.toString('base64') + '\r\n' }));

		client.on('close', function () {
			client.emit('command', '/part');
		});

		// Buffer network IO and emit message events
		client.on('message', function (data) {
			const lines = data.toString().split(/\n/);
			for (const line of lines) {
				if (line) client.emit('command', line);
			}
		});

		// Parse messages
		client.on('command', function (data) {
			var line = data.toString();
			console.log("IRC-Like Message: " + new Date().getTime() +  " " +  client.remoteAddress +" " + (client.user ? client.user.name + " " : "") +line)
			if (client.challenge) {
				if (client.challenge.answer == line) {
					client.user = new User(client);
					users.push(client.user);
					client.send(JSON.stringify({ server: help_message() }));
					client.challenge = undefined
				}
				else {
					client.send(JSON.stringify({ error: 'Failed captcha challenge' }));
					client.close();
				}
			}
			else {
				const base64 = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{4}|[A-Za-z0-9+\/]{3}=|[A-Za-z0-9+\/]{2}={2})$/
				const command = line.split(' ');
				// console.log(JSON.stringify(command))
				if (!command || command.length == 0) {
					client.send(JSON.stringify({ error: 'Invalid command. Enter \'/help\' for more information...' }));
				}
				else if (command[0] === "/help") {
					if (command.length > 1) {
						if (command[1] === "nick") {
							client.send(JSON.stringify({ server: '====== Command Help ======\n'+
							'Your current nickname is: "'+client.user.name+"\"\n\n"+
							"You can set your nickname to any alpha-numeric string (limited to regex: [A-z0-9][A-z0-9]*) with the following command:\n"+
							"/nick nickname\n\n"+
							"You cannot change your name once you've joined a channel. The server will respond with a JSON string in the following format:\n"+
							"{'nickname':'name'}\n\n"+
							"The 'nickname' value will be the same as the requested nickname if successfull.\n"+
							'====== End of Command Help ======'}));
						} else if (command[1] === "list") {
							client.send(JSON.stringify({ server: '====== Command Help ======\n'+
							"/list - This command will return a list of users if you are in a channel, or the list of channels otherwise.\n\n"+
							"The list of N users in channel 'channelName' in JSON format is:\n"+
							"{'channel':'channelName','users':[{'name':'name1','ip':'ip1'}, {'name':'name2','ip':'ip2'} ... {'name':'nameN','ip':'ipN'}]}\n\n"+
							"If you are not in a channel, then the JSON response will be the list of channels in the following JSON format:\n\n"+
							"{'channels':[{'name':'channelName','users': userCount#, 'max': maxUserCount# },...]\n"+
							'====== End of Command Help ======'}));
						} else if (command[1] === "join") {
							client.send(JSON.stringify({ server: '====== Command Help ======\n'+
							"/join channel [password] - This is the command for joining or creating a public channel optionally with a password.\n\n"+
							"Once you are in a channel, you can no longer change your nickname\n\n"+
							"The server responds (to all members of the channel) in the following JSON format when you or someone else joins or creates a channel:\n"+
							"{'channel':'channelName','users':[{'name':'name1','ip':'ip1'}, {'name':'name2','ip':'ip2'} ... {'name':'nameN','ip':'ipN'}]}\n\n"+
							"The 'users' value will contain the list of user users of the channel you are in, and the list of other users in your channel otherwise.\n"+
							'====== End of Command Help ======'}));
						} else if (command[1] === "say") {
							client.send(JSON.stringify({ server: '====== Command Help ======\n'+
							"/say {message} - Says non-space-delimited string message {message} in the currently joined channel.\n\n"+
							"The server relays {message} to all members of the channel in the following JSON format when you or someone else joins or creates a channel:\n"+
							"{'sayer':'user_name', 'says': '{message}', 'ip':'ipAddress' }\n\n"+
							"The 'sayer' value is the user who says the 'says' value, which is a non-space-delimited string.\n"+
							'====== End of Command Help ======'}));
						} else if (command[1] === "part") {
							client.send(JSON.stringify({ server: '====== Command Help ======\n'+
							"/part -  If in a channel, then parts that channel; closes the server connection otherwise.\n\n"+
							"The server notifies all members of the channel in the following JSON format when you or someone else leaves a channel:\n"+
							"{'part':'user_name','ip':'ipAddress'}\n\n"+
							"The 'part' value is the name of the user who left.\n"+
							'====== End of Command Help ======'}));
						} else if (command[1] === "help") {
							client.send(JSON.stringify({ error: "Hah. I\"m not THAT helpful..." }));
						}
						else {
							client.send(JSON.stringify({ server: help_message() }))
						}
					}
					else {
						client.send(JSON.stringify({ server: help_message() }))
					}
				} else if (command[0] === "/nick") {
					if(client.user.channel) {
						client.send(JSON.stringify({ error: 'Cannot change nickname while currently in a channel. Please enter "/help part" for more details...' }));
					} else if (command.length > 1 && command[1].length > 0) {
						if(command[1] == client.user.name)
							client.send(JSON.stringify({ error: 'Cannot change nickname. "'+client.user.name+'" is already your user name.' }));
						else
							client.user.assignName(command[1])
					} else {
						client.send(JSON.stringify({ error: 'Please provide a valid name (limited to regex: [A-z0-9][A-z0-9]*)...' }));
					}
				} else if (command[0] === "/list") {
					if(client.user.channel) {
						const user_list = client.user.channel.users.map((u)=>{return {name:u.name, ip:u.client.remoteAddress}})
						client.send(JSON.stringify({channel:client.user.channel.name, users:user_list}));
					} else {
						const names = channels.filter((channel)=>!channel.password).map((channel)=>{return {name:channel.name, users:channel.users.length, max:max_channel_size}})
						client.send(JSON.stringify({channels:names}));
					}
				} else if (command[0] === "/part") {
					if(client.user.channel) {
						client.user.channel.userLeave(client.user);
					} else if(client.readyState == WebSocket.OPEN) {
						client.close();
					} else {
						users = users.filter((u)=>u.name != client.user.name)
					}
				} else if (command[0] === "/join") {
					if(client.user.channel) {
						client.send(JSON.stringify({ error: 'Cannot join channel while currently in a channel. Please enter "/help part" for more details...' }));
					}
					else if (command.length < 2) {
						client.send(JSON.stringify({ error: 'Please provide a channel name...' }));
					}
					else {
						client.user.joinChannel(command[1], command[2])
					}
				} else if (command[0] === "/say") {
					if (command.length > 1) {
						command.shift()
						client.user.say(command.join(' '))
					} else {
						client.send(JSON.stringify({ error: 'Please provide a valid message when using /say. Enter "/help say" for more details.'}));
					}
				}
				else {
					client.send(JSON.stringify({ error: 'Command not found. Enter \'/help\' for more information...' }));
				}
			}
		});
		// Log all errors, do not die
		client.on('error', function () {
		});

		// Deliver answers over the network by default
		client.deliver = function (message) {
			console.debug(client.remoteAddress, client.name, '<<<', out);
			client.send(out);
		};

	};
};