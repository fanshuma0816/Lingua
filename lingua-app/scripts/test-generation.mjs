import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
const output=new URL('../test/.generation-build/',import.meta.url);
await mkdir(output,{recursive:true});
try {
 const browser=process.argv.includes('--browser');
 const file=new URL(browser?'generation-browser.mjs':'generation-api.test.mjs',output);
 await build({entryPoints:[new URL(browser?'../test/generation-browser.mjs':'../test/generation-api.test.mjs',import.meta.url).pathname],outfile:file.pathname,bundle:true,platform:'node',format:'esm',packages:'external'});
 const tests=[new URL('../test/generation-sql.test.mjs',import.meta.url).pathname,file.pathname];
 if(!browser){
  const client=new URL('generation-client.test.mjs',output);
  await build({entryPoints:[new URL('../test/generation-client.test.mjs',import.meta.url).pathname],outfile:client.pathname,bundle:true,platform:'node',format:'esm',packages:'external'});tests.push(client.pathname);
  const quota=new URL('quota-presentation.test.mjs',output);
  await build({entryPoints:[new URL('../test/quota-presentation.test.mjs',import.meta.url).pathname],outfile:quota.pathname,bundle:true,platform:'node',format:'esm',packages:'external'});tests.push(quota.pathname);
 }
 const result=spawnSync(process.execPath,browser?[file.pathname]:['--test',...tests],{stdio:'inherit',env:process.env});
 process.exitCode=result.status??1;
} finally {await rm(output,{recursive:true,force:true});}
