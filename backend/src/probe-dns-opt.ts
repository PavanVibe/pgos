import dns from 'dns';
import { promisify } from 'util';

const resolve = promisify(dns.resolve4);

async function scan() {
  console.log('Starting optimized DNS scan...');
  
  const concurrency = 150; // Moderate concurrency to prevent packet loss
  let activeCount = 0;
  
  const hexChars = '0123456789abcdef';
  const suffixes: string[] = [];
  
  for (const c1 of hexChars) {
    for (const c2 of hexChars) {
      for (const c3 of hexChars) {
        for (const c4 of hexChars) {
          suffixes.push(c1 + c2 + c3 + c4);
        }
      }
    }
  }

  console.log(`Total suffixes to scan: ${suffixes.length}`);
  
  // Scan in batches
  for (let idx = 0; idx < suffixes.length; idx += concurrency) {
    const batch = suffixes.slice(idx, idx + concurrency);
    const promises = batch.map(async (suffix) => {
      const domain = `pgos-production-${suffix}.up.railway.app`;
      try {
        await resolve(domain);
        console.log(`\nFOUND ACTIVE DOMAIN: https://${domain}\n`);
        activeCount++;
      } catch (err) {
        // DNS resolve failed, expected
      }
    });
    
    await Promise.all(promises);
    
    if (idx % 9000 < concurrency) {
      console.log(`Scanned ${idx} / ${suffixes.length} domains...`);
    }
  }
  
  console.log(`Scan completed. Found ${activeCount} active domains.`);
}

scan().catch(console.error);
