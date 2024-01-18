document.addEventListener('DOMContentLoaded', function () {
    fetch('/closures')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('closure-container');
            container.innerHTML = '';
            data = data['closuresByISD'];

            for (let isd in data) {
                const isdDiv = document.createElement('div');
                isdDiv.className = "mb-8";

                for (let county in data[isd]) {
                    const countyDiv = document.createElement('div');
                    countyDiv.className = "ml-4 mb-4";
                    let totalDistrictsInCounty = 0, closedDistrictsInCounty = 0;

                    for (let district in data[isd][county]) {
                        const districtData = data[isd][county][district];
                        const districtDiv = document.createElement('div');
                        districtDiv.className = "ml-8";

                        const isDistrictClosed = districtData.closed;
                        districtDiv.textContent = `${district}: ${isDistrictClosed ? "Closed" : "Open"}`;
                        districtDiv.className += isDistrictClosed ? " text-red-500" : " text-green-500";
                        countyDiv.appendChild(districtDiv);

                        totalDistrictsInCounty++;
                        if (isDistrictClosed) closedDistrictsInCounty++;
                    }

                    const countyStatus = closedDistrictsInCounty === totalDistrictsInCounty ? "Closed" : "Open";
                    const countyHeader = document.createElement('h3');
                    countyHeader.className = "text-xl font-semibold";
                    countyHeader.innerHTML = `${county} (Closed: ${closedDistrictsInCounty}, Open: ${totalDistrictsInCounty - closedDistrictsInCounty}) - ${countyStatus}`;
                    countyDiv.insertBefore(countyHeader, countyDiv.firstChild);
                    isdDiv.appendChild(countyDiv);
                }

                const totalDistrictsInISD = Object.keys(data[isd]).reduce((total, county) => total + Object.keys(data[isd][county]).length, 0);
                const closedDistrictsInISD = Object.keys(data[isd]).reduce((total, county) => total + Object.values(data[isd][county]).filter(district => district.closed).length, 0);
                const isdStatus = closedDistrictsInISD === totalDistrictsInISD ? "Closed" : "Open";
                const isdHeader = document.createElement('h2');
                isdHeader.className = "text-2xl font-bold";
                isdHeader.innerHTML = `${isd} (Closed: ${closedDistrictsInISD}, Open: ${totalDistrictsInISD - closedDistrictsInISD}) - ${isdStatus}`;
                container.appendChild(isdHeader);
                container.appendChild(isdDiv);
            }
        })
        .catch(error => console.error('Error:', error));
});