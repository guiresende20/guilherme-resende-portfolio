const apiKey = "AIzaSyAq6o3a8eihL-v-l9bKNe2vPI-wYAcVhaU";
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
.then(r => r.json())
.then(d => {
  const models = d.models.map(m => m.name).filter(m => m.includes("live") || m.includes("bidi") || m.includes("2.0"));
  console.log(models);
});
