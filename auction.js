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
					console.log(currentUser);
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
	let categoryChoices = categories.map((e, i) => ({ name: e, value: i }));
	inquirer
		.prompt([
			{ name: "title", message: "Title?" },
			{ name: "summary", message: "Summary?" },
			{
				name: "category",
				message: "Category?",
				type: "list",
				choices: categoryChoices,
			},
			{ name: "minbid", message: "Minimum Bid?", type: "number" },
		])
		.then((response) => {
			let invalid = isItemInvalid(response);
			if (invalid) {
				console.log(invalid);
			} else {
				// post to db
			}
		});
}

function itemIsInvalid(input) {
	if (input.title.length > 50) {
		return "Item name too long!";
	}
	if (item.summary.length > 100) {
		return "Summary length too long!";
	}
	if (isNaN(minbid) || minbid < 0) {
		return "Invalid Minimum Bid!";
	}
	return false;
}
function userBid() {
	let items = getItems();
	let itemChoices = items.map((e, i) => ({ name: e.title, value: i }));
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
			displayItemInfo(items[response.choice]);
		});
}

function getItems() {
	let items = [];
	connection.query("SELECT * FROM items", (err, res) => {
		if (err) throw err;
		items = res.map((e) => ({
			id: e.id,
			title: e.title,
			summary: e.summary,
			category: e.category,
			minbid: e.minbid,
			currentbid: e.currentbid,
		}));
	});
	return items;
}

function displayItemInfo(item) {
	let info = `${item.title}\nSummary: ${item.summary}\nCategory: ${item.category}\nStarting bid: ${item.minbid}\nCurrent Bid: ${item.currentbid}`;
	console.log(info);
}

async function attemptLogin() {
	let users = getUsers();
	let attempted;
	if (!users) {
		console.log("There Are no Users!");
		startUp();
		return;
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

	let selectedUser = users.find((e) => e.username === response.username);
	if (selectedUser) {
		if (response.password === selectedUser.password) {
			return selectedUser;
		} else {
			console.log("Not a valid username/password combination");
			attempted = true;
			attemptLogin();
		}
	} else {
		console.log("Not a valid username/password combination");
		attempted = true;
		attemptLogin();
	}
}

function userCreateAccount() {
	let users = getUsers();
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
function getUsers() {
	let users = [];
	connection.query("SELECT * FROM users", (err, res) => {
		if (err) throw err;
		res.forEach((e) =>
			// Probably not great to store password like this but here we are
			users.push({ id: e.id, username: e.username, password: e.password })
		);
	});
	return users;
}

function dbCreateAccount(username, password) {
	const query = connection.query(
		"INSERT INTO users SET ?",
		{ username, password },
		(err, res) => {
			if (err) throw err;
			console.log("user added!");
			console.log(getUsers());
		}
	);
}
