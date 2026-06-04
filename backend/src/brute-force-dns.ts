import dns from 'dns';
import { promisify } from 'util';

const resolve = promisify(dns.resolve4);

// Set DNS servers to fast public ones
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function scan() {
  console.log('Starting Railway domain DNS scan...');
  
  const concurrency = 2000;
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
        console.log(`FOUND ACTIVE DOMAIN: https://${domain}`);
        activeCount++;
      } catch (err) {
        // DNS resolve failed, expected
      }
    });
    
    await Promise.all(promises);
    
    if (idx % 10000 === 0 && idx > 0) {
      console.log(`Scanned ${idx} / ${suffixes.length} domains...`);
    }
  }
  
  console.log(`Scan completed. Found ${activeCount} active domains.`);
}

scan().catch(console.error);
