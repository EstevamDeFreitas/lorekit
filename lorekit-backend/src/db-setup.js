const { exec } = require("child_process");
const path = require("path");

function runMigrations() {
  return new Promise((resolve, reject) => {
    const prismaPath = path.join(__dirname, "..", "node_modules", ".bin", "prisma");

    exec(`${prismaPath} migrate deploy --schema=./prisma/schema.prisma`, 
      { cwd: path.join(__dirname, "..") },
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Erro aplicando migrações:", stderr);
          return reject(err);
        }
        console.log("✅ Migrações aplicadas com sucesso:", stdout);
        resolve();
      }
    );
  });
}

module.exports = { runMigrations };