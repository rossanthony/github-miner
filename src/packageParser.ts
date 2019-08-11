import * as readJson from 'read-package-json';
import * as shell from 'shelljs';
 
readJson('./data/packageJsons/kibana.7833168.package.json', console.error, false, function (er: any, data: any) {
    if (er) {
        console.error("There was an error reading the file")
        return;
    }
 
    // console.info('the package data is', data.dependencies);

    for (let key in data.dependencies) {
        console.log('key', key);
        const output = shell.exec(`npm view -json ${key}`, {silent:true});

        if (output.code === 0) {
            let npmMeta: any;
            try {
                npmMeta = JSON.parse(output);
            } catch (error) {
                console.error(`failed to parse JSON for ${key}`, error);
                return;
            }

            const dataToSave = {
                maintainers: npmMeta.maintainers,
                author: npmMeta.author,
                repository: npmMeta.repository,
                modified: npmMeta.time.modified,
                created: npmMeta.time.created,
                dependencies: npmMeta.dependencies,
                devDependencies: npmMeta.devDependencies,
                version: npmMeta.version,
                homepage: npmMeta.homepage,
                keywords: npmMeta.keywords,
                engines: npmMeta.engines,
            };

            console.log(`found ${key} in npm`, dataToSave);


        } else if (output.code === 0) {
            console.log(`failed to find ${key} in npm`);
        } else {
            console.error(`unexpected code for ${key}`, output.code);
        }
    }
});
