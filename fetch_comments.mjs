const urls = ['https://kamioka-games.com/WP10/comment_0', 'https://kamioka-games.com/WP10/comment_1'];

async function fetchTables() {
  for (const url of urls) {
    console.log(`\n=== ${url} ===`);
    const res = await fetch(url);
    const html = await res.text();
    // simple regex to find tables
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
    
    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      console.log('--- table ---');
      const tableContent = tableMatch[1];
      let trMatch;
      while ((trMatch = trRegex.exec(tableContent)) !== null) {
        const trContent = trMatch[1];
        let tdMatch;
        const row = [];
        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
          row.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
        }
        console.log(row.join(' | '));
      }
    }
  }
}

fetchTables().catch(console.error);
