async function run() {
  console.log("Fetching the JSON...");
  const res = await fetch("https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json");
  const data = await res.json();
  const classes = {};
  for (const item of data) {
    const cls = item.drug_class || "Other";
    classes[cls] = (classes[cls] || 0) + 1;
  }
  const sorted = Object.entries(classes).sort((a,b) => b[1] - a[1]);
  console.log("Unique drug classes:", sorted.length);
  console.log("Top 20 classes:", sorted.slice(0, 20));
}

run().catch(console.error);
