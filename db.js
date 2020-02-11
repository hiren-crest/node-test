
var mysql = require('mysql');
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "capittal_db"
});
con.connect(function(err) {
if (err) throw err;
console.log("DB Connected!");
});
module.exports = con