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
				when: (answers) => answers.try,
			},
			{
				name: "check",
				message: "Password again?",
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
