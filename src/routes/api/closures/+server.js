import { json } from '@sveltejs/kit';
import fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fuzzball from 'fuzzball';

const url = process.env.CLOSING_DATA_1;

// Function to fetch closure data
const fetchClosures = async () => {
    console.log('Fetching closures data...');
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        let schoolClosures = [];

        $('.closing').each((i, elem) => {
            const schoolName = $(elem).find('.text--primary.js-sort-value').text().trim();
            const closureStatus = $(elem).find('.text--secondary').first().text().trim();
            if (closureStatus.includes('Closed')) {
                schoolClosures.push({ schoolName, closureStatus });
            }
        });

        const michiganData = JSON.parse(fs.readFileSync('states/michigan.json', 'utf8'));
        const matchThreshold = 90;
        let closuresByISD = {};

        for (let isd in michiganData.Michigan) {
            for (let county in michiganData.Michigan[isd]) {
                for (const school of michiganData.Michigan[isd][county]) {
                    if (!closuresByISD[isd]) closuresByISD[isd] = {};
                    if (!closuresByISD[isd][county]) closuresByISD[isd][county] = {};

                    let isClosed = false;
                    for (const closure of schoolClosures) {
                        const matchScore = fuzzball.ratio(closure.schoolName.toLowerCase(), school.toLowerCase());
                        if (matchScore > matchThreshold) {
                            isClosed = closure.closureStatus.includes('Closed');
                            console.log(`Matched: "${school}" in ${isd}, ${county} - Status: ${isClosed ? 'Closed' : 'Open'} (Match score: ${matchScore})`);
                            break;
                        }
                    }

                    closuresByISD[isd][county][school] = { closed: isClosed };
                }
            }
        }

        return closuresByISD;
    } catch (error) {
        console.error(error);
        return {}; // Return empty data in case of error
    }
};

// Cache the closures data
let cachedClosures = {};

const updateClosures = async () => {
    cachedClosures = await fetchClosures();
    console.log('Closures updated:', cachedClosures);
};

// Initial fetch
updateClosures();

// Periodically update closures every 2.5 minutes
setInterval(updateClosures, 250000);

export const GET = async () => {
    return json(cachedClosures);
};
