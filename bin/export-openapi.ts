import app from "../index";

const res = await app.fetch(new Request("http://localhost/api/openapi.json"));
const spec = await res.json();

await Bun.write("www/openapi.json", JSON.stringify(spec, null, 2));
console.log("Wrote www/openapi.json");
