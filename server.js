const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const fuzzball = require('fuzzball');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const port = 3023;

let activeUsers = 0;

app.use(express.static('public')); // Serve static files from 'public' folder

const url = 'https://www.wxyz.com/weather/school-closings-delays';

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

// Broadcast to all connected clients
const broadcastClosures = async () => {
    const closures = await fetchClosures();

    const message = {
        type: 'closureData', // Add this line to include the 'type' field
        data: closures
    };
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message)); // Send the modified message
        }
    });
};

// Setup WebSocket connection
wss.on('connection', ws => {
    console.log('Client connected');
    activeUsers++;
    broadcastUserCount(); // Broadcast user count on new connection

    ws.on('close', () => {
        console.log('Client disconnected');
        activeUsers--;
        broadcastUserCount(); // Broadcast user count on disconnection
    });

    broadcastClosures(); // Broadcast closures when a client connects
});

const broadcastUserCount = () => {
    const message = {
        type: 'userCount',
        count: activeUsers
    };

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
};

broadcastClosures(); // Broadcast when the server starts

// Periodically check for updates
setInterval(() => {
    broadcastClosures();
}, 300000); // Every 5 minutes

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});