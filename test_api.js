
fetch('https://pointercrate.com/api/v1/demons/?limit=3')
    .then(response => response.json())
    .then(data => {
        console.log("Found " + data.length + " demons");
        if (data.length > 0) {
            console.log("First demon:", JSON.stringify(data[0], null, 2));
        }
    })
    .catch(err => console.error("Error:", err));
