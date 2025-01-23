import fs from "fs";
import archiver from "archiver";
import { exec } from 'child_process';

async function sh(cmd) {
    return new Promise(function (resolve, reject) {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error(stderr);
                reject(err);
            } else {
                console.log(stdout);
                resolve({ stdout, stderr });
            }
        });
    });
}
async function zip(src, dest) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(dest);

    return new Promise((resolve, reject) => {
        archive
            .directory(src, false)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
}
async function main() {
    if (!fs.existsSync("dist-bundle")) {
        fs.mkdirSync("dist-bundle")
    }
    await sh("npm run build");
    await zip("dist", "dist-bundle/satori-reader-anki-extension-chrome.zip");
    await sh("npm run build-dev");
    await zip("dist", "dist-bundle/satori-reader-anki-extension-chrome-dev.zip");
}

main();