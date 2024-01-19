const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const fuzzball = require('fuzzball');
const express = require('express');
const dotenv = require('dotenv');

const app = express();

dotenv.config();

// Use process.env.PORT and process.env.HOST to set the port and host from environment variables
const PORT = process.env.PORT || 3023;
const HOST = process.env.HOST || '0.0.0.0'; // Default to '0.0.0.0' (all interfaces)

app.listen(PORT, HOST, () => {
    console.log(`Server listening on port ${PORT}`);
});

app.use(express.static('public')); // Serve static files from 'public' folder

const url = process.env.CLOSING_DATA_1;

const fetchClosures = async () => {
    console.log("Fetching closures data...");
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

        // Iterate over each school in your .json file
        for (let isd in michiganData.Michigan) {
            for (let county in michiganData.Michigan[isd]) {
                for (const school of michiganData.Michigan[isd][county]) {
                    if (!closuresByISD[isd]) closuresByISD[isd] = {};
                    if (!closuresByISD[isd][county]) closuresByISD[isd][county] = {};

                    // Check if the school matches with any in the closed schools list
                    let isClosed = false;
                    for (const closure of schoolClosures) {
                        const matchScore = fuzzball.ratio(closure.schoolName.toLowerCase(), school.toLowerCase());
                        if (matchScore > matchThreshold) {
                            isClosed = closure.closureStatus.includes('Closed');
                            console.log(`Matched: "${school}" in ${isd}, ${county} - Status: ${isClosed ? 'Closed' : 'Open'} (Match score: ${matchScore})`);
                            break; // Stop searching once a match is found
                        }
                    }

                    closuresByISD[isd][county][school] = { closed: isClosed };
                }
            }
        }
        //console.log(closuresByISD) // Debugging Line
        return closuresByISD; // Return the processed data
    } catch (error) {
        console.error(error);
        return {}; // Return empty object in case of error
    }
};

app.get('/api/closures', async (req, res) => {
    try {
        const closures = await fetchClosures();
        res.json(closures);
    } catch (error) {
        console.error('Failed to get closure data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Periodically check for updates
setInterval(() => {
    fetchClosures();
}, 60000); // Every 5 minutes