document.addEventListener('DOMContentLoaded', function () {
	const container = document.getElementById('closure-container');
	const loader = document.getElementById('loader');
	const isdSelector = document.getElementById('isd-selector');
	const lastUpdatedElement = document.getElementById('last-updated');

	let lastReceivedData = {};

	const fetchClosureData = async () => {
		try {
			const response = await fetch('/api/closures');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			// Use the data to update the page
			updatePage(data, isdSelector.value);
			populateISDOptions(data); // Populate dropdown options
			updateLastUpdated(); // Update the timestamp after fetching data
		} catch (error) {
			console.error('Error fetching closure data:', error);
			// Handle errors, e.g., by showing a message to the user
		}
	};

	// Call fetchClosureData to get the data initially
	fetchClosureData();

	const updatePage = (data, selectedISD = 'all') => {
		console.log('Starting to update page with data:', data);
		// Hide the loader
		loader.style.display = 'none'; // Hide loader

		// Clear existing content
		container.innerHTML = '';

		for (let isd in data) {
			if (selectedISD !== 'all' && selectedISD !== isd) continue; // Filter based on selected ISD

			const isdDiv = document.createElement('div');
			isdDiv.className = 'mb-8';
			const isdHeader = document.createElement('h2');
			isdHeader.className = 'text-2xl font-bold';
			isdHeader.textContent = isd;
			isdDiv.appendChild(isdHeader);

			for (let county in data[isd]) {
				const countyDiv = document.createElement('div');
				countyDiv.className = 'ml-4 mb-4';
				const countyHeader = document.createElement('h3');
				countyHeader.className = 'text-xl font-semibold';
				countyHeader.textContent = county;
				countyDiv.appendChild(countyHeader);

				let totalDistricts = 0;
				let closedDistricts = 0;

				for (let district in data[isd][county]) {
					const districtData = data[isd][county][district];
					const districtDiv = document.createElement('div');
					districtDiv.className = 'ml-8';
					districtDiv.textContent = `${district}: ${districtData.closed ? 'Closed' : 'Open'}`;
					districtDiv.classList.add(districtData.closed ? 'text-red-500' : 'text-green-500');
					countyDiv.appendChild(districtDiv);

					totalDistricts++;
					if (districtData.closed) closedDistricts++;
				}

				const countyStatusDiv = document.createElement('p');
				countyStatusDiv.innerHTML = `${county} (Closed: ${closedDistricts}, Open: ${totalDistricts - closedDistricts}) - ${closedDistricts === totalDistricts ? 'Closed' : 'Open'}`;
				countyDiv.insertBefore(countyStatusDiv, countyHeader.nextSibling);
				isdDiv.appendChild(countyDiv);
			}

			container.appendChild(isdDiv);
		}

		console.log('Page update complete');
		lastReceivedData = data;
	};

	const updateLastUpdated = () => {
		const now = new Date();
		const lastUpdatedText = `Last Updated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
		lastUpdatedElement.textContent = lastUpdatedText;
	};

	const populateISDOptions = (data) => {
		Object.keys(data).forEach((isd) => {
			const option = document.createElement('option');
			option.value = isd;
			option.textContent = isd;
			isdSelector.appendChild(option);
		});
	};

	isdSelector.addEventListener('change', function () {
		updatePage(lastReceivedData, this.value);
		updateLastUpdated(); // Update the timestamp on ISD change
	});

	// Periodic data refresh
	setInterval(() => {
		fetchClosureData();
	}, 300000); // Every 5 minutes
});
