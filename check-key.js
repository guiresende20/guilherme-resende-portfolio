fetch("https://guiresende20.netlify.app/api/get-live-key")
.then(r => r.json())
.then(d => console.log("LIVE KEY:", d.key))
.catch(e => console.error(e));
