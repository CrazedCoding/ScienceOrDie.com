console.log("You need to install your SSL certificate/key using certbot in order to proceed.")
console.log("Please see https://certbot.eff.org")

const fs = require('fs');
const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let new_opts;

try {
    new_opts = require('./config.json');
} catch (error) {
    new_opts = {};    
}

const { hostname } = require('os');

function generate() {
    console.log("Generating ./config.json\n...")
    fs.writeFileSync('./config.json', new_opts);
    rl.close()
}

function prompt_correct() {
    new_opts = JSON.stringify(new_opts, null, 2);
    console.log(new_opts)
    const g_correct = "Is the above configuration correct (y/n)?\n"
    rl.question(g_correct, function (yn) {
        if(yn.toUpperCase() == 'Y')
            generate();
        else {
            new_opts = JSON.parse(new_opts);
            prompt_ssl()
        }
    });

}

function prompt_ssl() {
    const q_cert = "What is the path to your SSL cert/pem file" + (new_opts.ssl && new_opts.ssl.cert ? " (ENTER for " + new_opts.ssl.cert + ")" : "") + "?\n"
    const q_key = "What is the path to your SSL key/pem file" + (new_opts.ssl && new_opts.ssl.key ? " (ENTER for " + new_opts.ssl.key + ")" : "") + "?\n"
    rl.question(q_cert, function (cert) {
        rl.question(q_key, function (key) {
            new_opts.ssl = {
                cert: !cert && new_opts.ssl ? new_opts.ssl.cert : cert,
                key: !key && new_opts.ssl ? new_opts.ssl.key : key
            }
            const h_correct = "What is your server hostname (ENTER for '"+hostname+"')?\n"
            rl.question(h_correct, function (host) {
                new_opts.server_hostname = (host ? host : hostname) +""
                prompt_correct();
            });
        });
    });
}

rl.on("close", function () {
    console.log("Exiting.");
    process.exit(0);
});

prompt_ssl()