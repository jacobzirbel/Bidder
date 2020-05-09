const inquirer = require("inquirer");
const mysql = require("mysql");
const info = require("./connection-info");

const connection = mysql.createConnection({
	host: info.host,
	port: 3306,
	user: info.username,
	password: info.password,
	database: info.dbName,
});

connection.connect((err) => {
	if (err) throw err;
	console.log("connected to db");
	startUp();
});

let currentUser;

function startUp() {
	if (!currentUser) {
		inquirer
			.prompt([
				{
					name: "login",
					type: "list",
					message: "Login or Create Account",
					choices: [
						{ name: "Log In", value: 1 },
						{ name: "Create Account", value: 2 },
					],
				},
			])
			.then(async (response) => {
				if (response.login === 1) {
					currentUser = await attemptLogin();
					if (!currentUser) {
						startUp();
					} else {
						startAsUser();
					}
				} else {
					userCreateAccount();
				}
			});
	} else {
		startAsUser();
	}
}

function startAsUser() {
	console.log("Logged in as " + currentUser.username);
	inquirer
		.prompt([
			{
				name: "do",
				message: "What would you like to do?",
				type: "list",
				choices: [
					{ name: "BID", value: 1 },
					{ name: "POST", value: 2 },
				],
			},
		])
		.then((response) => {
			if (response.do === 1) {
				userBid();
			} else if (response.do === 2) {
				userPost();
			}
		});
}

function userPost() {
	let categories = ["cat 1", "cat 2", "cat 3", "cat 4"];
	//let categoryChoices = categories.map((e, i) => ({ name: e, value: i }));
	inquirer
		.prompt([
			{ name: "title", message: "Title?" },
			{ name: "summary", message: "Summary?" },
			{
				name: "category",
				message: "Category?",
				type: "list",
				choices: categories,
			},
			{ name: "minbid", message: "Minimum Bid?", type: "number" },
		])
		.then((response) => {
			let invalid = itemIsInvalid(response);
			if (invalid) {
				console.log(invalid);
				userPost();
			} else {
				postItemToDatabase(response);
			}
		});
}

function postItemToDatabase(item) {
	const query = connection.query(
		"INSERT INTO items SET ?",
		{
			title: item.title,
			summary: item.summary,
			category: item.category,
			minbid: item.minbid,
			currentbid: item.minbid,
			currentwinnerid: null,
			posterid: currentUser.id,
		},
		(err, res) => {
			if (err) throw err;
			console.log("Item added!");
			startAsUser();
		}
	);
}

function itemIsInvalid(input) {
	if (input.title.length > 50) {
		return "Item name too long!";
	}
	if (input.summary.length > 100) {
		return "Summary length too long!";
	}
	if (isNaN(input.minbid) || input.minbid < 0) {
		return "Invalid Minimum Bid!";
	}
	return false;
}

async function userBid() {
	let items = await getItems();
	let itemChoices = items.map((e, i) => ({ name: e.title, value: i }));
	if (items.length === 0) {
		console.log("There are no items posted!");
		startAsUser();
	} else {
		inquirer
			.prompt([
				{
					name: "choice",
					message: "Which item would you like to see?",
					type: "list",
					choices: itemChoices,
				},
			])
			.then((response) => {
				let item = items[response.choice];
				displayItemInfo(item);
				enterBidAmount(item);
			});
	}
}

function enterBidAmount(item) {
	inquirer
		.prompt([
			{
				name: "bid",
				type: "number",
				message: "How much would you like to bid?",
			},
		])
		.then((response) => {
			if (response.bid > item.currentbid) {
				// Should probably await these
				addBidToBids(item, response.bid);
				updateItem(item, response.bid);
				startAsUser();
			} else {
				console.log("Sorry! That is not a high enough bid!");
				startAsUser();
			}
		});
}

function updateItem(item, bid) {
	const query = connection.query("UPDATE items SET ? WHERE ? ", [
		{ currentbid: bid, currentwinnerid: currentUser.id },
		{ id: item.id },
	]);
}

function addBidToBids(item, bid) {
	const query = connection.query("INSERT INTO bids SET ? ", [
		{ amount: bid, userid: currentUser.id, itemid: item.id },
	]);
}

async function getItems() {
	let itemsPromise = (() => {
		return new Promise((resolve, reject) => {
			connection.query("SELECT * FROM items", (err, res) => {
				if (err) throw err;

				// Probably not great to store password like this but here we are
				resolve(
					res.map((e) => ({
						id: e.id,
						title: e.title,
						summary: e.summary,
						category: e.category,
						minbid: e.minbid,
						currentbid: e.currentbid,
					}))
				);
			});
		});
	})();
	let items = await itemsPromise;

	return [...items];
}

function displayItemInfo(item) {
	let info = `${item.title}\nSummary: ${item.summary}\nCategory: ${item.category}\nStarting bid: ${item.minbid}\nCurrent Bid: ${item.currentbid}`;
	console.log(info);
}

async function attemptLogin() {
	let users = await getUsers();
	let attempted;
	if (users.length === 0) {
		console.log("There Are no Users!");
		return false;
	}

	let response = await inquirer.prompt([
		{
			name: "try",
			message: "Login?",
			type: "list",
			choices: [
				{ name: "Yes", value: true },
				{ name: "No", value: false },
			],
		},
		{
			name: "username",
			message: "username?",
			when: (answers) => answers.try,
		},
		{
			name: "password",
			message: "password?",
			type: "password",
			when: (answers) => answers.try,
		},
	]);

	if (!response.try) startUp();

	let selectedUser = users.find((e) => e.username === response.username);

	if (selectedUser) {
		if (response.password === selectedUser.password) {
			return selectedUser;
		} else {
			console.log("Not a valid username/password combination");
			attempted = true;
			return false;
		}
	} else {
		console.log("Not a valid username/password combination");
		attempted = true;
		return false;
	}
}

async function userCreateAccount() {
	let users = await getUsers();

	inquirer
		.prompt([
			{
				name: "try",
				message: "Create Account?",
				type: "list",
				choices: [
					{ name: "Yes", value: true },
					{ name: "No", value: false },
				],
			},
			{
				name: "username",
				message: "Username?",
				when: (answers) => answers.try,
			},
			{
				name: "password",
				message: "Password?",
				type: "password",
				when: (answers) => answers.try,
			},
			{
				name: "check",
				message: "Password again?",
				type: "password",
				when: (answers) => answers.try,
			},
		])
		.then((response) => {
			if (response.username.length < 1) {
				console.log("You must enter a username!");
				userCreateAccount();
			}
			if (users.find((e) => e.username === response.username)) {
				console.log("Username taken!");
				userCreateAccount();
			}
			if (response.password === response.check) {
				dbCreateAccount(response.username, response.password);
			} else {
				console.log("Passwords must match!");
				userCreateAccount();
			}
		});
}

async function getUsers() {
	let users = await (() => {
		return new Promise((resolve, reject) => {
			connection.query("SELECT * FROM users", (err, res) => {
				if (err) throw err;
				resolve(
					res.map((e) =>
						// Probably not great to store password like this but here we are
						({ id: e.id, username: e.username, password: e.password })
					)
				);
			});
		});
	})();

	return [...users];
}

async function dbCreateAccount(username, password) {
	const query = connection.query(
		"INSERT INTO users SET ?",
		{ username, password },
		(err, res) => {
			if (err) throw err;
			console.log("user added!");
			startUp();
		}
	);
}
