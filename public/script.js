document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('closure-container');
    const loader = document.getElementById('loader');
    const ws = new WebSocket('wss://snow.hamy.cloud:8985');
    const statusDiv = document.getElementById('status');
    const userCountDiv = document.getElementById('user-count');
    const isdSelector = document.getElementById('isd-selector');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const html = document.documentElement;

    document.getElementById('dark-mode-toggle').addEventListener('change', function () {
        if (this.checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    });
    window.onload = () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'dark') {
            darkModeToggle.checked = true;
            html.classList.add('dark');
        } else {
            darkModeToggle.checked = false;
            html.classList.remove('dark');
        }
    };
    // Connect to WebSocket
    const connectWebSocket = () => {
        ws.onopen = () => {
            console.log('Connected to WebSocket');
            statusDiv.textContent = 'Connected to WebSocket server';
            statusDiv.style.color = 'green';
            loader.style.display = 'block'; // Show loader
        };

        ws.onmessage = (event) => {
            try {
                console.log('Received raw message:', event.data);
                const message = JSON.parse(event.data);

                if (message.type === 'closureData') {
                    lastReceivedData = message.data; // Store the data
                    populateISDOptions(message.data); // Populate dropdown options
                    updatePage(message.data, isdSelector.value); // Initial update
                } else if (message.type === 'userCount') {
                    userCountDiv.textContent = `Active users: ${message.count}`;
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            statusDiv.textContent = 'WebSocket connection error';
            statusDiv.style.color = 'red';
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected. Attempting to Reconnect...');
            statusDiv.textContent = 'Disconnected from WebSocket server. Reconnecting...';
            statusDiv.style.color = 'orange';
            setTimeout(connectWebSocket, 5000); // Attempt to reconnect every 5 seconds
        };
    }

    connectWebSocket();

    const updatePage = (data, selectedISD = 'all') => {
        console.log('Starting to update page with data:', data);
        // Hide the loader
        loader.style.display = 'none'; // Hide loader

        // Clear existing content
        container.innerHTML = '';

        for (let isd in data) {
            //console.log('ISD:', isd);
            if (selectedISD !== 'all' && selectedISD !== isd) continue; // Filter based on selected ISD

            const isdDiv = document.createElement('div');
            isdDiv.className = "mb-8";
            const isdHeader = document.createElement('h2');
            isdHeader.className = "text-2xl font-bold";
            isdHeader.textContent = isd;
            isdDiv.appendChild(isdHeader);

            for (let county in data[isd]) {
                //console.log('County:', county);
                const countyDiv = document.createElement('div');
                countyDiv.className = "ml-4 mb-4";
                const countyHeader = document.createElement('h3');
                countyHeader.className = "text-xl font-semibold";
                countyHeader.textContent = county;
                countyDiv.appendChild(countyHeader);

                let totalDistricts = 0;
                let closedDistricts = 0;

                for (let district in data[isd][county]) {
                    //console.log('District:', district);
                    const districtData = data[isd][county][district];
                    const districtDiv = document.createElement('div');
                    districtDiv.className = "ml-8";
                    districtDiv.textContent = `${district}: ${districtData.closed ? "Closed" : "Open"}`;
                    districtDiv.classList.add(districtData.closed ? "text-red-500" : "text-green-500");
                    countyDiv.appendChild(districtDiv);

                    totalDistricts++;
                    if (districtData.closed) closedDistricts++;
                }

                const countyStatusDiv = document.createElement('p');
                countyStatusDiv.innerHTML = `${county} (Closed: ${closedDistricts}, Open: ${totalDistricts - closedDistricts}) - ${closedDistricts === totalDistricts ? "Closed" : "Open"}`;
                countyDiv.insertBefore(countyStatusDiv, countyHeader.nextSibling);
                isdDiv.appendChild(countyDiv);
            }

            container.appendChild(isdDiv);
        }

        console.log('Page update complete');
    };

    const populateISDOptions = (data) => {
        Object.keys(data).forEach(isd => {
            const option = document.createElement('option');
            option.value = isd;
            option.textContent = isd;
            isdSelector.appendChild(option);
        });
    };

    isdSelector.addEventListener('change', function () {
        updatePage(lastReceivedData, this.value);
    });
});