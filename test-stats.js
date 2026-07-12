async function checkStats() {
  try {
    const res = await fetch("http://localhost:3000/api/admin/stats", {
      cache: "no-store",
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text.substring(0, 500));
  } catch (err) {
    console.error(err);
  }
}
checkStats();
