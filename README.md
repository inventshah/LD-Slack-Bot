# LD Debate Slack Bot
------------------
A custom slack bot to streamline LD debate tasks. Get pairings, view opponent wikis, find analytics, and more all in Slack!

### Slack Setup:
1. Create a new slack app with a "Bot User", and initalize the enviroment variables on your server with the given credentials.
2. Add the Slack commands as listed below, with the request URL as the domain of your server plus '/slack/events'.
3. In OAuth & Permissions, make sure the following are listed in Scopes:
bot, chat:write:bot, commands

### Enviroment Variables:
```
BOT_TOKEN = <Slack bot access token starting with xoxb->
SIGNING_SECRET = <Slack signing secret>
DB_URL = <IBM Cloudant database url>
IAM_KEY = <IBM IAM API Key>
SCHOOL = <School code as on tabroom>
```
### Cloudant Database Setup:
[IBM Cloudant's free tier](https://www.ibm.com/cloud/cloudant) gives 1GB of free database storage, which should be plenty for analytics.

Create a databse called "args" and add arguments as documents in the form:

```
{
	name:<Name of argument>,
	type:<Sortable type>,
	arg:<Argument content>
}
```
Example:

```
{
	name:'resolution',
	type:'substance',
	arg:'Resolved: The United States ought to eliminate subsidies for fossil fuels.'
}
```
The "arg" field is [Slack formatted text](https://slack.com/help/articles/202288908-format-your-messages), so use \n for newlines and \t for tabs where needed.

### Slack Commands:
```
/wiki [School] [Debater's Last Name] [Aff/Neg]
Messages the caselist for the specified

/setpairings [tabroom pairing url]
Sets the tournament url to retrieve pairings from

/pairings
Messages the current pairings for your school including links to paradigms

/timer [minutes:seconds]
Starts a timer for the specified time

/arglist [optional: type]
Lists arguments in your schools database by type
The default types are: 'theory', 'larp', 'phil', 'tricks', 'ks', 'misc'

/arg [name]
Messages the argument content

/flip
Flips a coin
```
### Node Dependencies:
- @cloudant/cloudant
- @slack/bolt
- htmlparser2
- tabletojson
- xmlhttprequest

### Built With:
- Javascript
- Slack Bolt Framework
- Node.js
