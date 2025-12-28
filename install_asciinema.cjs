const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const url = "https://github.com/asciinema/asciinema/releases/download/v2.4.0/asciinema-2.4.0-linux-amd64.tar.gz";
const file = fs.createWriteStream("asciinema.tar.gz");

console.log("⬇️  Baixando Asciinema...");

https.get(url, function(response) {
   // Handle redirects
   if (response.statusCode === 302 || response.statusCode === 301) {
       https.get(response.headers.location, function(redirectResponse) {
           redirectResponse.pipe(file);
           file.on('finish', () => install());
       });
   } else {
       response.pipe(file);
       file.on('finish', () => install());
   }
});

function install() {
    file.close(() => {
        console.log("📦 Extraindo...");
        try {
            execSync("tar -xzf asciinema.tar.gz");
            execSync("mv asciinema-2.4.0-linux-amd64/asciinema ./asciinema");
            execSync("chmod +x ./asciinema");
            // Cleanup
            execSync("rm -rf asciinema.tar.gz asciinema-2.4.0-linux-amd64");
            console.log("\n✅ SUCESSO! Para gravar, digite:\n./asciinema rec demo.cast");
        } catch (e) {
            console.error("❌ Erro na extração. Verifique se o arquivo baixou corretamente.");
        }
    });
}
