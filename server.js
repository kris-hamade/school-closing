const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const fuzzball = require('fuzzball');
const express = require('express');
const app = express();
const port = 3023;

app.use(express.static('public')); // Serve static files from 'public' folder

const url = 'https://www.wxyz.com/weather/school-closings-delays';

app.get('/closures', (req, res) => {
    // Define a score threshold
    const scoreThreshold = 90;

    // Load and flatten your JSON data
    const michiganData = JSON.parse(fs.readFileSync('states/michigan.json', 'utf8'));
    let mySchoolList = [];

    Object.values(michiganData.Michigan['Oakland Schools']).forEach(district => {
        Object.values(district).forEach(county => {
            mySchoolList = mySchoolList.concat(county);
        });
    });

    // Normalize function
    const normalize = (name) => {
        return name.toLowerCase()
            .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
            .trim();
    };
    const normalizedMySchoolList = mySchoolList.map(normalize);

    axios.get(url)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);
            const schoolClosures = [];

            $('.closing').each((i, elem) => {
                const schoolName = $(elem).find('.text--primary.js-sort-value').text().trim();
                const closureStatus = $(elem).find('.text--secondary').first().text().trim();

                if (closureStatus.includes('Closed')) {
                    schoolClosures.push({ schoolName, closureStatus });
                }
            });

            // Fuzzy matching with threshold
            const matchedClosures = schoolClosures.map(closure => {
                const normalizedClosureName = normalize(closure.schoolName);
                let bestMatch = { name: '', score: 0, index: -1 };

                normalizedMySchoolList.forEach((school, index) => {
                    const score = fuzzball.ratio(normalizedClosureName, school);
                    if (score > bestMatch.score) {
                        bestMatch = { name: mySchoolList[index], score, index };
                    }
                });

                if (bestMatch.score >= scoreThreshold) {
                    return {
                        originalName: closure.schoolName,
                        matchedName: bestMatch.name,
                        closureStatus: closure.closureStatus,
                        score: bestMatch.score
                    };
                }
            }).filter(match => match); // Filter out undefined values

            console.log(matchedClosures);

            let closuresByISD = {};
            matchedClosures.forEach(match => {
                if (match) {
                    for (let isd in michiganData.Michigan) {
                        for (let county in michiganData.Michigan[isd]) {
                            if (michiganData.Michigan[isd][county].includes(match.matchedName)) {
                                if (!closuresByISD[isd]) {
                                    closuresByISD[isd] = {};
                                }
                                if (!closuresByISD[isd][county]) {
                                    closuresByISD[isd][county] = michiganData.Michigan[isd][county].reduce((acc, district) => {
                                        acc[district] = { closed: false };
                                        return acc;
                                    }, {});
                                }
                                closuresByISD[isd][county][match.matchedName].closed = true;
                                break;
                            }
                        }
                    }
                }
            });

            // Process the data for output
            for (let isd in closuresByISD) {
                console.log(`${isd}:`);
                for (let county in closuresByISD[isd]) {
                    console.log(`  ${county}:`);
                    let allClosed = true;
                    for (let district in closuresByISD[isd][county]) {
                        const isClosed = closuresByISD[isd][county][district].closed;
                        console.log(`    ${district}: ${isClosed ? "Closed" : "Open"}`);
                        if (!isClosed) allClosed = false;
                    }

                    if (allClosed) {
                        console.log(`All districts in ${county} are closed.`);
                    }
                }
            }
            res.json({ closuresByISD });
        })
        .catch(console.error);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});