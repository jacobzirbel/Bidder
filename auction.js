const inquirer = require("inquirer");
const mysql = require("mysql");
const info = require("./connection-info");
const connection = mysql.createConnection({
	host: info.host,
	port: 3306,
	user: info.username,
	password: info.username,
	database: info.dbName,
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
		.then((response) => {
			if (response.login === 1) {
				attemptLogin();
			} else {
				createAccount();
			}
		});
}

async function attemptLogin() {
	let users = getUsers();
	console.log(users);
	let attempted;
	let response = await inquirer.prompt([
		{
			name: "try",
			message: "attempt login?",
			type: "list",
			choices: ["Yes", "No"],
		},
		{
			name: "username",
			message: "username?",
			when: (answers) => answers.try === "Yes",
		},
		{
			name: "password",
			message: "password?",
			when: (answers) => answers.try === "Yes",
		},
	]);

	let selectedUser = users.find((e) => e.username === response.username);
	if (selectedUser) {
		if (response.password === selectedUser.password) {
			currentUser = selectedUser;
			return;
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
function getUsers() {
	let users = [];
	connection.query("SELECT * FROM users", (err, res) => {
		if (err) throw err;
		res.forEach((e) =>
			// Probably not great to store password like this but here we are
			users.push({ id: e.id, name: e.name, password: e.password })
		);
	});
}
