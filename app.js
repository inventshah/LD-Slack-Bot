const { App } = require('@slack/bolt');

const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const htmlparser2 = require('htmlparser2');
const tabletojson = require('tabletojson');

const Cloudant = require('@cloudant/cloudant');
const cloudant = new Cloudant(
	{ 
		url: process.env.DB_URL,
		plugins: {
			iamauth: { 
				iamApiKey: process.env.IAM_KEY
			} 
		} 
	}
);

const app = new App({
	token: process.env.BOT_TOKEN,
	signingSecret: process.env.SIGNING_SECRET
});


const db = cloudant.db.use("args");

const argtypes = ['theory', 'larp', 'phil', 'tricks', 'ks', 'misc'];

app.command('/arglist',  async ({ command, ack, respond, say }) => {
	ack();

	const internaltypes = command.text ? command.text.split(' ') : argtypes;

	var lists = [];
	Promise.all(internaltypes.map(type=>{
		return db.find({ selector: { type:type } })
		.then(result=>{
			if (result.docs.length !== 0)
			{
				lists.push([type, ...result.docs.map(d=>`\t${d.name}`)].join('\n'))
			}
		})
	}))
	.then(()=>{
		lists = lists.join('\n\n');
		respond({
			response_type: 'ephemeral',
			blocks: [
			{
				"type": "section",
				"text": {
					"type": 'plain_text',
					"text": 'Arguments:'
				}
			},
			{
				"type": "section",
				"text": {
					"type": 'mrkdwn',
					"text": lists
				}
			}
			]
		});
	});
});

app.command('/arg',  async ({ command, ack, respond, say }) => {
	ack();

	db.find({ selector: { name:command.text.toLowerCase() } })
	.then(result=>{
		if (result.docs.length !== 1)
		{
			respond({
				response_type: 'ephemeral',
				text: 'There are no arguments matching that name'
			});
		}
		else
		{
			respond({
				response_type: 'in_channel',
				text: result.docs[0].arg
			});
		}
	})
	.catch(err=>console.log(err));
});

const botToken = process.env.BOT_TOKEN;

var tournamentUrl = 'https://www.tabroom.com/index/tourn/postings/round.mhtml?tourn_id=13417&round_id=450085';
const tabroom = 'https://www.tabroom.com/';
const wikiurl = 'https://hsld.debatecoaches.org/';

const school_code = process.env.SCHOOL_CODE;

const getHTML = function(url)
{
	var xhr = new XMLHttpRequest();

	xhr.open('GET', url, false);
	xhr.send();

	if (xhr.status === 404)
	{
		return;
	}

	return xhr.responseText;
}

const getWikiCaselist = function(html)
{
	var titles = [];

	var bool = false;
	const parser = new htmlparser2.Parser(
	{
		onopentag(name, attribs)
		{
			if (name === 'h4' && attribs.name)
			{
				bool = attribs.name.includes('title');
			}
		},
		ontext(text)
		{
			if (bool)
			{
				titles.push(text);
				bool = false;
			}
		},
	},
	{ decodeEntities: true }
	);

	parser.write(html);
	parser.end();

	return titles;
}

const getPairingUrl = function(html)
{
	var next = null;

	const parser = new htmlparser2.Parser(
	{
		onopentag(name, attribs) {
			if (name === 'a' && attribs.href.includes('/postings/round')) {
				if (next === null)
				{
					next = attribs.href;
				}
			}
		},
	},
	{ decodeEntities: true }
	);

	parser.write(html);
	parser.end();

	return next;
}

const getJudgeLinks = function(html)
{
	const base = 'index/tourn/postings/';
	var next = [];
	var currentUrl = "";

	const parser = new htmlparser2.Parser(
	{
		onopentag(name, attribs) {
			if (name === 'a' && attribs.href.includes('judge.mhtml?judge')) {
				currentUrl = base.concat(attribs.href);
			}
		},
		ontext(text) {
			if (currentUrl !== "") {
				const judge = text.replace(/\t/g, '').split(/\n+/).join(' ').trim();
				next[judge] = `<${tabroom.concat(currentUrl)}|${judge}>`;
				currentUrl = "";
			}
		}
	},
	{ decodeEntities: true }
	);

	parser.write(html);
	parser.end();

	return next;
}

const pairings = function (url, say)
{
	const html = getHTML(url);

	const pairingUrl = getPairingUrl(html);
	console.log(pairingUrl)

	const pairingHtml = getHTML(tabroom.concat(pairingUrl));

	const table = tabletojson.convert(pairingHtml)[0];
	const judgeLinks = getJudgeLinks(pairingHtml);

	var blocks = [
		{
			"type": 'section',
			"text": {
				"type": 'mrkdwn',
				"text": `*=== Pairings ===*`
			}
		}
	]

	table.forEach((text, index)=>{
		const flt = text['Flt'] || "";
		const room = text['Room'];
		const aff = text['1'] || text['Aff'] || 'none';
		const neg = text['2'] || text['Neg'] || 'none';
		const judge = (text['Judge'] || text['Judges'] || 'none').replace(/\t/g, '').split(/\n+/).join(' ');

		if (aff.includes(school_code) || neg.includes(school_code))
		{
			blocks.push(
				{
					"type": 'section',
					"text": {
						"type": 'mrkdwn',
						"text": [flt, room, aff, neg, (judgeLinks[judge] || judge)].join('\t')
					}
				},
				{
					"type": 'divider'
				}
			)
		}
	});

	say({blocks: blocks});
};

app.command('/pairings',  async ({ command, ack, respond, say }) => {
	ack();
	if (command.channel_name !== 'directmessage')
	{
		pairings(tournamentUrl, say);
	}
	else
	{
		respond({
			response_type: 'ephemeral',
			text: 'Error make sure you are in a channel'
		});
	}
});

app.command('/setpairings',  async ({ command, ack, respond, say }) => {
	ack();

	if (command.text.includes('postings') && command.channel_name !== 'directmessage')
	{
		tournamentUrl = command.text;
		say({
			blocks: [
				{
					"type": 'context',
					"elements": [
						{
							"type": 'mrkdwn',
							"text": `_Tournament set by: ${command.user_name}_` 
						}
					]
				}
			]
		});
	}
	else
	{
		respond({
			response_type: 'ephemeral',
			text: `Error make sure you are in a channel and have a valid url: ${command.text}`
		});
	}
});

const wiki = function(text)
{
	const paths = text.split(' ');
	const ending = paths.splice(paths.length - 2);

	const url = wikiurl.concat(paths.join('%20'), '/', ending.join('%20'));

	const html = getHTML(url);

	if (!html)
	{
		return [{
			type: 'section',
			text: {
				type: 'plain_text',
				text: `${text} is invalid or has no entries`
			}
		}];
	}

	const titles = getWikiCaselist(html);
	const blocks = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `<${url}|${text}>`
			}
		},
		{
			type: "divider"
		},
		{
			type: 'section',
			text: {
				type: 'plain_text',
				text: titles.join('\n') || 'No Entries'
			}
		}
	];
	
	return blocks;
};

app.command('/wiki',  async ({ command, ack, respond }) => {
	ack();

	blocks = wiki(command.text);

	respond({
		response_type: command.channel_name === 'directmessage' ? 'in_channel' : 'ephemeral',
		blocks: blocks
	});
});

const update_message = function(response, text)
{
	return app.client.chat.update({
		token: botToken,
		channel: response['channel'],
		ts: response['ts'],
		text: text
	});
}

const print_time = function(ms)
{
	const minutes = parseInt(ms / 60000);
	var seconds = parseInt((ms % 60000) / 1000);

	seconds = (seconds < 10) ? '0' + seconds : seconds;

	return `${minutes}:${seconds}`;
}

const startTimer = function(ms, response)
{
	const timesteps = 2000;
	var time = ms - timesteps;
	var interval = setInterval(()=>{
		update_message(response, `Time left: ${print_time(time)}`);
		time -= timesteps;
	}, timesteps);

	new Promise(resolve => setTimeout(resolve, ms))
		.then(()=>app.client.chat.postMessage({
			token: botToken,
			channel: response['channel'],
			text: '=== Time is up! ===',
		}))
		.then(()=>clearInterval(interval))
		.catch((err)=> console.log(err));
}

app.command('/timer',  async ({ command, ack, respond, say }) => {
	ack();

	if (command.text !== "")
	{
		const input = command.text.split(':');
		const ms = 60000 * parseFloat(input[0] || 0) + 1000 * parseFloat(input[1] || 0);

		app.client.chat.postMessage({
			as_user: false,
			token: botToken,
			channel: command.user_id,
			text: `Setting timer for ${command.text}`
		}).then((result)=>startTimer(ms, result)).catch((err)=> console.log(err));
	}
	else
	{
		respond({
			response_type: 'ephemeral',
			text: 'Error with /timer! Make sure you gave a time'
		});
	}
});

app.command('/flip',  async ({ command, ack, respond }) => {
	ack();

	respond({
		response_type: 'in_channel',
		text: Math.random() < 0.5 ? "Tails" : "Heads"
	});
});

(async () => {
	await app.start(process.env.PORT || 3000);
	console.log('lhpld running!');
})();